import { Injectable, Logger } from "@nestjs/common";
import { fixTanween } from "../../common/text/arabic.util";
import { chapterBody, chapterTitle, coinsBody, newsTitle, NOTIFICATION_TYPES, seriesTitle, type NotificationCategory } from "./notification-text";
import { NotificationsRepository } from "./notifications.repository";

const DEFAULT_PAGE = 30;
const MAX_PAGE = 100;

/**
 * `notify()` is called by OTHER services when something happens to an account (security, moderation, coins, a team
 * decision); it is never its own HTTP endpoint. The content-driven kinds — a new chapter of a series in the member's
 * library, a new series, a news post — are written by the `…Published/…Added` methods below, which never throw: a
 * notification failing must not undo the publish that caused it.
 */
@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);

  constructor(private readonly repo: NotificationsRepository) {}

  notify(userId: string, type: string, title: string, body?: string, link?: string, refId?: string) {
    return this.repo.create({ userId, type, title: fixTanween(title), body: fixTanween(body), link, refId });
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
    });
  }

  /** The owner added coins to this account. */
  async coinsGranted(userId: string, amount: number, note?: string | null): Promise<void> {
    await this.safely("coins", async () => {
      await this.repo.create({ userId, type: NOTIFICATION_TYPES.coins, title: "وصلتك عملات", body: fixTanween(coinsBody(amount, note)), link: "/store" });
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
