import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AnnouncementsRepository } from "./announcements.repository";

/**
 * A chapter published in the minute after another of the same work goes out in one announcement, not one each: publishing a batch
 * must not flood a channel. And two announcements are never closer than this, whichever works they are about. A new work waits the
 * same minute, so the team has time to give it its cover before it is announced.
 */
const GATHER_MS = 60_000;
const SPACING_MS = 1_500;
const SEND_TIMEOUT_MS = 8_000;

/** Enough of the site's address to build links from; the key proves to Bing (IndexNow) that this site's files are ours. */
const DEFAULT_SITE = "https://lunexteam.com";
/** Not a secret: it is published on the site itself, at `/<key>.txt` (frontend `public/`). */
const DEFAULT_INDEXNOW_KEY = "0dfe21d467149da7cb31f2051b4a298c";
/** The community server's roles that are pinged: those who follow new chapters, and those who follow new works. Not secrets; settings can replace them. */
const DEFAULT_CHAPTER_ROLE = "1472481779662196736";
const DEFAULT_SERIES_ROLE = "1474536152697671874";

const clip = (text: string, max: number) => {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length <= max ? one : `${one.slice(0, max - 1).trimEnd()}…`;
};
/** Telegram's limit for the caption of a photo (counted on the text, not the markup). */
const TELEGRAM_CAPTION_MAX = 1024;
const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const isWebhook = (url: string | undefined): url is string => !!url && /^https:\/\/(?:[a-z]+\.)?discord(?:app)?\.com\/api\/webhooks\//i.test(url);
const roleId = (value: string | undefined, fallback: string) => {
  const id = (value ?? fallback).trim();
  return /^\d{15,25}$/.test(id) ? id : undefined;
};

interface Post {
  name: string;
  link: string;
  cover?: string;
  /** The chapter's own featured picture, when it has one: shown large, in place of the work's cover in a photo post. */
  picture?: string;
  summary: string;
  team: string | null;
}

/** A team's own Discord server, when it set a webhook there (its address and the role to ping — its own, never the site's). */
type TeamDiscord = { webhookUrl: string; roleId: string | null } | null;

/**
 * Tells the outside world about what just went live: a chapter, or a new work. A post in the community's Discord (a webhook per
 * room, pinging the role that follows it), *and*, when the work's team set its own webhook (`Team.discordWebhookUrl`), a second
 * post in the team's own Discord server — pinging that server's own role (`Team.discordRoleId`) if it set one, never the site's
 * role (a server's webhook and role ids only ever mean something on that one server). And, for a chapter, in the Telegram
 * channel (a bot); and a ping to Bing and the other IndexNow search engines so the page is found
 * within minutes (Google does not use IndexNow; it reads the sitemap). Each channel is switched on by its own setting and does
 * nothing without it: `DISCORD_WEBHOOK_URL` (chapters), `DISCORD_NEW_SERIES_WEBHOOK_URL` (new works), `TELEGRAM_BOT_TOKEN` +
 * `TELEGRAM_CHAT_ID`; IndexNow needs none. It never throws — the chapter or work is already published, and a channel being down
 * must not undo that.
 */
@Injectable()
export class AnnouncementsService implements OnModuleDestroy {
  private readonly log = new Logger(AnnouncementsService.name);
  private readonly pending = new Map<string, { numbers: Set<number>; timer: NodeJS.Timeout }>();
  private readonly pendingSeries = new Map<string, NodeJS.Timeout>();
  private queue: Promise<void> = Promise.resolve();

  private readonly site: string;
  private readonly discordChapters?: string;
  private readonly discordSeries?: string;
  private readonly chapterRole?: string;
  private readonly seriesRole?: string;
  private readonly telegramToken?: string;
  private readonly telegramChat?: string;
  private readonly indexNowKey: string;

  constructor(
    private readonly repo: AnnouncementsRepository,
    config: ConfigService
  ) {
    this.site = (config.get<string>("FRONTEND_URL") ?? DEFAULT_SITE).replace(/\/+$/, "");
    const chapters = config.get<string>("DISCORD_WEBHOOK_URL")?.trim();
    const series = config.get<string>("DISCORD_NEW_SERIES_WEBHOOK_URL")?.trim();
    this.discordChapters = isWebhook(chapters) ? chapters : undefined;
    this.discordSeries = isWebhook(series) ? series : undefined;
    this.chapterRole = roleId(config.get<string>("DISCORD_CHAPTER_ROLE_ID"), DEFAULT_CHAPTER_ROLE);
    this.seriesRole = roleId(config.get<string>("DISCORD_SERIES_ROLE_ID"), DEFAULT_SERIES_ROLE);
    this.telegramToken = config.get<string>("TELEGRAM_BOT_TOKEN")?.trim() || undefined;
    this.telegramChat = config.get<string>("TELEGRAM_CHAT_ID")?.trim() || undefined;
    this.indexNowKey = config.get<string>("INDEXNOW_KEY")?.trim() || DEFAULT_INDEXNOW_KEY;
  }

  onModuleDestroy() {
    for (const { timer } of this.pending.values()) clearTimeout(timer);
    for (const timer of this.pendingSeries.values()) clearTimeout(timer);
    this.pending.clear();
    this.pendingSeries.clear();
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

  /** Call when a new work is listed. Returns at once; the announcement follows about a minute later (once, whatever happens to it meanwhile). */
  seriesAdded(seriesId: string): void {
    if (this.pendingSeries.has(seriesId)) return;
    const timer = setTimeout(() => this.flushSeries(seriesId), GATHER_MS);
    timer.unref();
    this.pendingSeries.set(seriesId, timer);
  }

  /** Sends what is waiting for one work now (the timer's job; public so a test can do it without waiting). */
  flush(seriesId: string): Promise<void> {
    const waiting = this.pending.get(seriesId);
    if (!waiting) return this.queue;
    clearTimeout(waiting.timer);
    this.pending.delete(seriesId);
    return this.enqueue(() => this.announce(seriesId, [...waiting.numbers]));
  }

  /** The new-work announcement for one work, now (public for the same reason). */
  flushSeries(seriesId: string): Promise<void> {
    const timer = this.pendingSeries.get(seriesId);
    if (!timer) return this.queue;
    clearTimeout(timer);
    this.pendingSeries.delete(seriesId);
    return this.enqueue(() => this.announceSeries(seriesId));
  }

  private enqueue(job: () => Promise<void>): Promise<void> {
    this.queue = this.queue
      .then(job)
      .catch((error) => this.log.warn(`announcement failed: ${error instanceof Error ? error.message : String(error)}`))
      .then(() => new Promise<void>((resolve) => setTimeout(resolve, SPACING_MS).unref()));
    return this.queue;
  }

  private coverOf(series: { id: string; updatedAt: Date; coverAssetId: string | null }) {
    return series.coverAssetId ? `${this.site}/api/catalog/series/${series.id}/cover?v=${series.updatedAt.getTime()}` : undefined;
  }

  private async announce(seriesId: string, published: number[]) {
    const series = await this.repo.findSeries(seriesId);
    if (!series || series.state !== "approved") return;
    const numbers = await this.repo.stillPublished(seriesId, published);
    if (numbers.length === 0) return;

    const [team, genres, teamDiscord] = await Promise.all([this.repo.teamName(series.teamId), this.repo.genres(seriesId), this.repo.teamDiscord(series.teamId)]);
    const name = series.titleAr || series.titleEn;
    const label = numbers.length === 1 ? `الفصل ${numbers[0]}` : `الفصول ${numbers[0]}–${numbers[numbers.length - 1]}`;
    const seriesUrl = `${this.site}/series/${encodeURIComponent(series.slug)}`;
    const link = numbers.length === 1 ? `${seriesUrl}/${numbers[0]}` : seriesUrl;
    const featured = await this.repo.latestThumbnail(seriesId, numbers);
    const picture = featured ? `${this.site}/api/catalog/chapters/${featured.id}/thumbnail?v=${featured.thumbnailAssetId.slice(0, 8)}` : undefined;
    const post: Post = { name, link, cover: this.coverOf(series), picture, summary: clip(series.synopsis, 180), team };

    await Promise.all([
      this.postDiscordChapter(post, label, teamDiscord),
      this.postTelegram({ ...post, label, synopsis: series.synopsis, genres }),
      this.pingIndexNow([...numbers.map((n) => `${seriesUrl}/${n}`), seriesUrl]),
    ]);
  }

  private async announceSeries(seriesId: string) {
    const series = await this.repo.findSeries(seriesId);
    if (!series || series.state !== "approved") return;
    const [team, genres, teamDiscord] = await Promise.all([this.repo.teamName(series.teamId), this.repo.genres(seriesId), this.repo.teamDiscord(series.teamId)]);
    const seriesUrl = `${this.site}/series/${encodeURIComponent(series.slug)}`;
    await Promise.all([
      this.postDiscordSeries({ name: series.titleAr || series.titleEn, link: seriesUrl, cover: this.coverOf(series), summary: clip(series.synopsis, 400), team }, genres, teamDiscord),
      this.pingIndexNow([seriesUrl]),
    ]);
  }

  /** The words that go with a ping: the role's mention, and the permission to ping exactly that role and nobody else. */
  private ping(role: string | undefined) {
    return role ? { content: `<@&${role}>`, allowed_mentions: { parse: [], roles: [role] } } : { allowed_mentions: { parse: [] } };
  }

  /** The team's own webhook, re-checked before sending (its stored value could be edited directly), with its own server's role — never the site's. */
  private async postToTeamServer(embed: unknown, team: TeamDiscord) {
    if (!team || !isWebhook(team.webhookUrl)) return;
    await this.send("Discord (team)", team.webhookUrl, { username: "LUNEX TEAM", ...this.ping(roleId(team.roleId ?? undefined, "")), embeds: [embed] });
  }

  private async postDiscordChapter(p: Post, label: string, team: TeamDiscord) {
    const embed = {
      title: `${label} — ${p.name}`,
      url: p.link,
      description: p.summary,
      color: 0x7c3aed,
      ...(p.cover ? { thumbnail: { url: p.cover } } : {}),
      ...(p.picture ? { image: { url: p.picture } } : {}),
      footer: { text: p.team ? `الفريق: ${p.team}` : "LUNEX TEAM" },
      timestamp: new Date().toISOString(),
    };
    await Promise.all([
      this.discordChapters ? this.send("Discord", this.discordChapters, { username: "LUNEX TEAM", ...this.ping(this.chapterRole), embeds: [embed] }) : undefined,
      this.postToTeamServer(embed, team),
    ]);
  }

  private async postDiscordSeries(p: Post, genres: string[], team: TeamDiscord) {
    const fields = [...(genres.length > 0 ? [{ name: "التصنيف", value: genres.join("، "), inline: false }] : []), ...(p.team ? [{ name: "الفريق", value: p.team, inline: true }] : [])];
    const embed = {
      title: `عمل جديد — ${p.name}`,
      url: p.link,
      description: p.summary,
      color: 0x7c3aed,
      ...(fields.length > 0 ? { fields } : {}),
      ...(p.cover ? { image: { url: p.cover } } : {}),
      footer: { text: "LUNEX TEAM" },
      timestamp: new Date().toISOString(),
    };
    await Promise.all([
      this.discordSeries ? this.send("Discord", this.discordSeries, { username: "LUNEX TEAM", ...this.ping(this.seriesRole), embeds: [embed] }) : undefined,
      this.postToTeamServer(embed, team),
    ]);
  }

  /**
   * The channel's own look: a tag, the title, then the details in quote blocks — the chapter and genres, and the story in an
   * expandable one (Telegram folds it after a few lines and the reader opens it) — then the team and "مشاهدة ممتعة" as the link to
   * the chapter. The story is cut to what fits the caption of a photo, which Telegram caps at 1024 characters.
   */
  private async postTelegram(p: Post & { label: string; synopsis: string; genres: string[] }) {
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

    const photo = p.picture ?? p.cover;
    if (photo && (await this.send("Telegram", `${api}/sendPhoto`, { chat_id: this.telegramChat, photo, caption: html, parse_mode: "HTML" }))) return;
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
