import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AnnouncementsRepository } from "./announcements.repository";

/**
 * A chapter published in the minute after another of the same work goes out in one announcement, not one each: publishing a batch
 * must not flood a channel. And two announcements are never closer than this, whichever works they are about.
 */
const GATHER_MS = 60_000;
const SPACING_MS = 1_500;
const SEND_TIMEOUT_MS = 8_000;

/** Enough of the site's address to build links from; the key proves to Bing (IndexNow) that this site's files are ours. */
const DEFAULT_SITE = "https://lunexteam.com";
/** Not a secret: it is published on the site itself, at `/<key>.txt` (frontend `public/`). */
const DEFAULT_INDEXNOW_KEY = "0dfe21d467149da7cb31f2051b4a298c";

const clip = (text: string, max: number) => {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length <= max ? one : `${one.slice(0, max - 1).trimEnd()}…`;
};
/** Telegram's limit for the caption of a photo (counted on the text, not the markup). */
const TELEGRAM_CAPTION_MAX = 1024;
const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Tells the outside world about a chapter that just went live: a post in the team's Discord channel (a webhook) and Telegram
 * channel (a bot), and a ping to Bing and the other IndexNow search engines so the page is found within minutes (Google does
 * not use IndexNow; it reads the sitemap). Each channel is switched on by its own setting and does nothing without it:
 * `DISCORD_WEBHOOK_URL`, `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`; IndexNow needs none. It never throws — the chapter is
 * already published, and a channel being down must not undo that.
 */
@Injectable()
export class AnnouncementsService implements OnModuleDestroy {
  private readonly log = new Logger(AnnouncementsService.name);
  private readonly pending = new Map<string, { numbers: Set<number>; timer: NodeJS.Timeout }>();
  private queue: Promise<void> = Promise.resolve();

  private readonly site: string;
  private readonly discord?: string;
  private readonly telegramToken?: string;
  private readonly telegramChat?: string;
  private readonly indexNowKey: string;

  constructor(
    private readonly repo: AnnouncementsRepository,
    config: ConfigService
  ) {
    this.site = (config.get<string>("FRONTEND_URL") ?? DEFAULT_SITE).replace(/\/+$/, "");
    const hook = config.get<string>("DISCORD_WEBHOOK_URL")?.trim();
    this.discord = hook && /^https:\/\/(?:[a-z]+\.)?discord(?:app)?\.com\/api\/webhooks\//i.test(hook) ? hook : undefined;
    this.telegramToken = config.get<string>("TELEGRAM_BOT_TOKEN")?.trim() || undefined;
    this.telegramChat = config.get<string>("TELEGRAM_CHAT_ID")?.trim() || undefined;
    this.indexNowKey = config.get<string>("INDEXNOW_KEY")?.trim() || DEFAULT_INDEXNOW_KEY;
  }

  onModuleDestroy() {
    for (const { timer } of this.pending.values()) clearTimeout(timer);
    this.pending.clear();
  }

  /** Call when a chapter goes live. Returns at once; the announcement follows about a minute later, with any others of the same work. */
  chapterPublished(seriesId: string, number: number): void {
    const waiting = this.pending.get(seriesId);
    if (waiting) {
      waiting.numbers.add(number);
      return;
    }
    const timer = setTimeout(() => this.flush(seriesId), GATHER_MS);
    timer.unref();
    this.pending.set(seriesId, { numbers: new Set([number]), timer });
  }

  /** Sends what is waiting for one work now (the timer's job; public so a test can do it without waiting). */
  flush(seriesId: string): Promise<void> {
    const waiting = this.pending.get(seriesId);
    if (!waiting) return this.queue;
    clearTimeout(waiting.timer);
    this.pending.delete(seriesId);
    const numbers = [...waiting.numbers];
    this.queue = this.queue
      .then(() => this.announce(seriesId, numbers))
      .catch((error) => this.log.warn(`announcement failed: ${error instanceof Error ? error.message : String(error)}`))
      .then(() => new Promise<void>((resolve) => setTimeout(resolve, SPACING_MS).unref()));
    return this.queue;
  }

  private async announce(seriesId: string, published: number[]) {
    const series = await this.repo.findSeries(seriesId);
    if (!series || series.state !== "approved") return;
    const numbers = await this.repo.stillPublished(seriesId, published);
    if (numbers.length === 0) return;

    const [team, genres] = await Promise.all([this.repo.teamName(series.teamId), this.repo.genres(seriesId)]);
    const name = series.titleAr || series.titleEn;
    const label = numbers.length === 1 ? `الفصل ${numbers[0]}` : `الفصول ${numbers[0]}–${numbers[numbers.length - 1]}`;
    const seriesUrl = `${this.site}/series/${encodeURIComponent(series.slug)}`;
    const link = numbers.length === 1 ? `${seriesUrl}/${numbers[0]}` : seriesUrl;
    const cover = series.coverAssetId ? `${this.site}/api/catalog/series/${series.id}/cover?v=${series.updatedAt.getTime()}` : undefined;
    const summary = clip(series.synopsis, 180);

    await Promise.all([
      this.postDiscord({ name, label, link, cover, summary, team }),
      this.postTelegram({ name, label, link, cover, summary, team, synopsis: series.synopsis, genres }),
      this.pingIndexNow([...numbers.map((n) => `${seriesUrl}/${n}`), seriesUrl]),
    ]);
  }

  private async postDiscord(p: { name: string; label: string; link: string; cover?: string; summary: string; team: string | null }) {
    if (!this.discord) return;
    const body = {
      username: "LUNEX TEAM",
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: `${p.label} — ${p.name}`,
          url: p.link,
          description: p.summary,
          color: 0x7c3aed,
          ...(p.cover ? { thumbnail: { url: p.cover } } : {}),
          footer: { text: p.team ? `الفريق: ${p.team}` : "LUNEX TEAM" },
          timestamp: new Date().toISOString(),
        },
      ],
    };
    await this.send("Discord", this.discord, body);
  }

  /**
   * The channel's own look: a tag, the title, then the details in quote blocks — the chapter and genres, and the story in an
   * expandable one (Telegram folds it after a few lines and the reader opens it) — then the team and "مشاهدة ممتعة" as the link to the chapter. The story
   * is cut to what fits the caption of a photo, which Telegram caps at 1024 characters.
   */
  private async postTelegram(p: { name: string; label: string; link: string; cover?: string; summary: string; team: string | null; synopsis: string; genres: string[] }) {
    if (!this.telegramToken || !this.telegramChat) return;
    const api = `https://api.telegram.org/bot${this.telegramToken}`;
    const genres = p.genres.length > 0 ? p.genres.join("، ") : null;
    const fixed = ["#فصل_جديد", p.name, `الفصل: ${p.label}`, ...(genres ? [`التصنيف: ${genres}`] : []), "القصة: ", ...(p.team ? [`الفريق: ${p.team}`] : []), "مشاهدة ممتعة"];
    const room = TELEGRAM_CAPTION_MAX - fixed.reduce((sum, line) => sum + line.length + 2, 0) - 20;
    const story = room >= 80 ? clip(p.synopsis, room) : "";
    const html = [
      "#فصل_جديد",
      `<b>${escapeHtml(p.name)}</b>`,
      `<blockquote>${escapeHtml(`الفصل: ${p.label}`)}${genres ? `\n${escapeHtml(`التصنيف: ${genres}`)}` : ""}</blockquote>`,
      ...(story ? [`<blockquote expandable>${escapeHtml(`القصة: ${story}`)}</blockquote>`] : []),
      ...(p.team ? [`الفريق: ${escapeHtml(p.team)}`] : []),
      `<a href="${escapeHtml(p.link)}">مشاهدة ممتعة</a>`,
    ].join("\n\n");
    // The plain twin, for the rare Telegram that will not take the quote blocks.
    const plain = ["#فصل_جديد", `${p.name} — ${p.label}`, ...(story ? [story] : []), p.link, ...(p.team ? [`الفريق: ${p.team}`] : [])].join("\n\n");

    if (p.cover && (await this.send("Telegram", `${api}/sendPhoto`, { chat_id: this.telegramChat, photo: p.cover, caption: html, parse_mode: "HTML" }))) return;
    if (await this.send("Telegram", `${api}/sendMessage`, { chat_id: this.telegramChat, text: html, parse_mode: "HTML" })) return;
    await this.send("Telegram", `${api}/sendMessage`, { chat_id: this.telegramChat, text: plain });
  }

  /** Bing and the other IndexNow engines. Skipped where the site is not really online (a developer's machine). */
  private async pingIndexNow(urls: string[]) {
    const host = new URL(this.site).host;
    if (/^(localhost|127\.|\[::1\])/.test(host)) return;
    await this.send("IndexNow", "https://api.indexnow.org/indexnow", { host, key: this.indexNowKey, keyLocation: `${this.site}/${this.indexNowKey}.txt`, urlList: urls });
  }

  /** One POST; the address is never logged (a webhook address and a bot token are secrets). */
  private async send(channel: string, url: string, body: unknown): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      if (!response.ok) this.log.warn(`${channel} answered ${response.status}`);
      return response.ok;
    } catch (error) {
      this.log.warn(`${channel} could not be reached (${error instanceof Error ? error.name : "error"})`);
      return false;
    }
  }
}
