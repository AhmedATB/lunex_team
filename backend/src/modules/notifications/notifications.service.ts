import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { fixTanween } from "../../common/text/arabic.util";
import { chapterBody, chapterTitle, coinsBody, newsTitle, NOTIFICATION_TYPES, seriesTitle, type NotificationCategory } from "./notification-text";
import { PushService } from "../push/push.service";
import type { PushCategory } from "../push/push.repository";
import { NotificationsRepository } from "./notifications.repository";

const DEFAULT_PAGE = 30;
/** Chapters of one work published within this long of each other reach a phone as one notification, not one each. */
const CHAPTER_PUSH_GATHER_MS = 60_000;

/** Which switch in a member's notification settings a kind of notification is under. */
const pushCategoryOf = (type: string): PushCategory => {
  switch (type) {
    case NOTIFICATION_TYPES.chapter:
      return "chapters";
    case "reply":
      return "replies";
    case NOTIFICATION_TYPES.series:
    case NOTIFICATION_TYPES.news:
      return "news";
    default:
      return "account";
  }
};
const MAX_PAGE = 100;

/**
 * `notify()` is called by OTHER services when something happens to an account (security, moderation, coins, a team
 * decision); it is never its own HTTP endpoint. The content-driven kinds — a new chapter of a series in the member's
 * library, a new series, a news post — are written by the `…Published/…Added` methods below, which never throw: a
 * notification failing must not undo the publish that caused it.
 */
@Injectable()
export class NotificationsService implements OnModuleDestroy {
  private readonly log = new Logger(NotificationsService.name);
  private readonly chapterPushes = new Map<string, { numbers: Set<number>; slug: string; title: string; timer: NodeJS.Timeout }>();

  constructor(
    private readonly repo: NotificationsRepository,
    private readonly push: PushService
  ) {}

  /** A notification to a phone is a bonus: whatever happens to it must not undo or delay what caused it. */
  private alsoPush(sending: Promise<void>) {
    sending.catch((error) => this.log.warn(`push failed: ${error instanceof Error ? error.message : String(error)}`));
  }

  onModuleDestroy() {
    for (const { timer } of this.chapterPushes.values()) clearTimeout(timer);
    this.chapterPushes.clear();
  }

  async notify(userId: string, type: string, title: string, body?: string, link?: string, refId?: string) {
    const row = await this.repo.create({ userId, type, title: fixTanween(title), body: fixTanween(body), link, refId });
    // Also to the member's phone or computer, if they asked for that (never waited for, never fails what caused it).
    this.alsoPush(this.push.toUser(userId, pushCategoryOf(type), { title: fixTanween(title), body: fixTanween(body), url: link, tag: `${type}-${refId ?? "n"}` }));
    return row;
  }

  async list(userId: string, params: { category?: NotificationCategory; limit?: number; before?: string } = {}) {
    const limit = Math.min(Math.max(params.limit ?? DEFAULT_PAGE, 1), MAX_PAGE);
    const before = params.before ? new Date(params.before) : undefined;
    const [rows, unreadCount] = await Promise.all([
      this.repo.listForUser(userId, { category: params.category, limit: limit + 1, before: before && !Number.isNaN(+before) ? before : undefined }),
      this.repo.countUnread(userId),
    ]);
    const items = rows.slice(0, limit).map((item) => ({ ...item, title: fixTanween(item.title), body: fixTanween(item.body) }));
    return { items, unreadCount, hasMore: rows.length > limit };
  }

  async unreadCount(userId: string) {
    return { unreadCount: await this.repo.countUnread(userId) };
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.repo.markRead(userId, id);
  }

  async markAllRead(userId: string, category?: NotificationCategory): Promise<void> {
    await this.repo.markAllRead(userId, category);
  }

  /** A chapter of `seriesId` went live: everyone who has the series in their library hears about it (folded per series while unread). */
  async chapterPublished(seriesId: string, chapterNumber: number): Promise<void> {
    await this.safely("chapter", async () => {
      const series = await this.repo.findSeriesLabel(seriesId);
      if (!series) return;
      const latest = String(chapterNumber);
      await this.repo.notifyChapter({
        seriesId,
        title: fixTanween(chapterTitle(series.titleAr || series.titleEn)),
        link: `/series/${series.slug}/${chapterNumber}`,
        latest,
        firstBody: chapterBody(1, latest),
      });
      this.gatherChapterPush(seriesId, chapterNumber, series.slug, series.titleAr || series.titleEn);
    });
  }

  /** Holds a new chapter's push for a minute, so a batch of chapters is one line on the phone ("الفصول 13–20"), then sends it. */
  private gatherChapterPush(seriesId: string, number: number, slug: string, title: string) {
    const waiting = this.chapterPushes.get(seriesId);
    if (waiting) {
      waiting.numbers.add(number);
      return;
    }
    const timer = setTimeout(() => void this.flushChapterPush(seriesId), CHAPTER_PUSH_GATHER_MS);
    timer.unref();
    this.chapterPushes.set(seriesId, { numbers: new Set([number]), slug, title, timer });
  }

  /** Sends what is waiting for one work now (the timer's job; public so a test does not have to wait). */
  async flushChapterPush(seriesId: string): Promise<void> {
    const waiting = this.chapterPushes.get(seriesId);
    if (!waiting) return;
    clearTimeout(waiting.timer);
    this.chapterPushes.delete(seriesId);
    const numbers = [...waiting.numbers].sort((a, b) => a - b);
    const single = numbers.length === 1;
    const featured = await this.repo.latestChapterThumbnail(seriesId, numbers).catch(() => null);
    await this.push.toLibraryReaders(seriesId, {
      image: featured ? `/api/catalog/chapters/${featured.id}/thumbnail?v=${featured.thumbnailAssetId.slice(0, 8)}` : undefined,
      title: fixTanween(chapterTitle(waiting.title)),
      body: single ? chapterBody(1, String(numbers[0])) : `صدرت الفصول ${numbers[0]}–${numbers[numbers.length - 1]}`,
      url: single ? `/series/${waiting.slug}/${numbers[0]}` : `/series/${waiting.slug}`,
      tag: `chapter-${seriesId}`,
    });
  }

  /** A new series joined the catalogue: everyone hears about it. */
  async seriesAdded(seriesId: string): Promise<void> {
    await this.safely("series", async () => {
      const series = await this.repo.findSeriesLabel(seriesId);
      if (!series) return;
      await this.repo.broadcast({
        type: NOTIFICATION_TYPES.series,
        title: fixTanween(seriesTitle(series.titleAr || series.titleEn)),
        body: fixTanween(series.synopsis.trim().slice(0, 140) || null),
        link: `/series/${series.slug}`,
        refId: seriesId,
      });
      this.alsoPush(this.push.toEveryone("news", { title: fixTanween(seriesTitle(series.titleAr || series.titleEn)), body: fixTanween(series.synopsis.trim().slice(0, 140)) || undefined, url: `/series/${series.slug}`, tag: `series-${seriesId}` }));
    });
  }

  /** A news post went live: everyone hears about it. */
  async newsPublished(newsId: string): Promise<void> {
    await this.safely("news", async () => {
      const news = await this.repo.findNewsLabel(newsId);
      if (!news || !news.isPublished) return;
      await this.repo.broadcast({
        type: NOTIFICATION_TYPES.news,
        title: fixTanween(newsTitle(news.title)),
        body: fixTanween(news.excerpt.trim().slice(0, 140) || null),
        link: `/news?post=${newsId}`,
        refId: newsId,
      });
      this.alsoPush(this.push.toEveryone("news", { title: fixTanween(newsTitle(news.title)), body: fixTanween(news.excerpt.trim().slice(0, 140)) || undefined, url: `/news?post=${newsId}`, tag: `news-${newsId}` }));
    });
  }

  /** The owner added coins to this account. */
  async coinsGranted(userId: string, amount: number, note?: string | null): Promise<void> {
    await this.safely("coins", async () => {
      await this.repo.create({ userId, type: NOTIFICATION_TYPES.coins, title: "وصلتك عملات", body: fixTanween(coinsBody(amount, note)), link: "/store" });
      this.alsoPush(this.push.toUser(userId, "account", { title: "وصلتك عملات", body: fixTanween(coinsBody(amount, note)), url: "/store", tag: "coins" }));
    });
  }

  private async safely(kind: string, work: () => Promise<void>) {
    try {
      await work();
    } catch (error) {
      this.log.warn(`could not write ${kind} notifications: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
