import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { FOLLOWED_TYPES, type NotificationCategory } from "./notification-text";

const typeFilter = (category: NotificationCategory | undefined) => {
  switch (category) {
    case "chapters":
      return { type: "chapter" };
    case "series":
      return { type: "series" };
    case "news":
      return { type: "news" };
    case "other":
      return { type: { notIn: [...FOLLOWED_TYPES] } };
    default:
      return {};
  }
};

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: { userId: string; type: string; title: string; body?: string; link?: string; refId?: string }) {
    return this.prisma.notification.create({ data });
  }

  /** Newest first, optionally one category and only those older than `before` (the page's cursor). */
  listForUser(userId: string, params: { category?: NotificationCategory; limit: number; before?: Date }) {
    return this.prisma.notification.findMany({
      where: { userId, ...typeFilter(params.category), ...(params.before ? { createdAt: { lt: params.before } } : {}) },
      orderBy: { createdAt: "desc" },
      take: params.limit,
    });
  }

  countUnread(userId: string) {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }

  /** Scoped by userId, not just id — a caller can only ever mark their OWN notification read, never guess someone else's id. */
  markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
  }

  markAllRead(userId: string, category?: NotificationCategory) {
    return this.prisma.notification.updateMany({ where: { userId, read: false, ...typeFilter(category) }, data: { read: true } });
  }

  /** One row for every account that is not banned (a new series, a news post). One statement, however many accounts there are. */
  broadcast(data: { type: string; title: string; body: string | null; link: string | null; refId: string | null }) {
    return this.prisma.$executeRaw`
      INSERT INTO "notifications" ("id", "userId", "type", "title", "body", "link", "refId", "count", "read", "createdAt")
      SELECT gen_random_uuid()::text, u."id", ${data.type}, ${data.title}, ${data.body}, ${data.link}, ${data.refId}, 1, false, now()
      FROM "users" u
      WHERE u."isBanned" = false`;
  }

  /**
   * A chapter came out: tell everyone who has the series in their library. A member who still has an unread notification
   * about this series gets it updated (one more chapter, the newest one named, moved to the top) rather than another row
   * beside it, so four chapters published together are one notification, not four.
   */
  notifyChapter(data: { seriesId: string; title: string; link: string; latest: string; firstBody: string }) {
    return this.prisma.$transaction([
      this.prisma.$executeRaw`
        UPDATE "notifications" SET
          "count" = "count" + 1,
          "title" = ${data.title},
          "body" = CASE
            WHEN "count" + 1 = 2 THEN 'صدر فصلان جديدان — آخرها الفصل ' || ${data.latest}
            WHEN "count" + 1 <= 10 THEN 'صدرت ' || ("count" + 1)::text || ' فصول جديدة — آخرها الفصل ' || ${data.latest}
            ELSE 'صدر ' || ("count" + 1)::text || ' فصلًا جديدًا — آخرها الفصل ' || ${data.latest}
          END,
          "link" = ${data.link},
          "createdAt" = now()
        WHERE "type" = 'chapter' AND "refId" = ${data.seriesId} AND "read" = false
          AND "userId" IN (SELECT "userId" FROM "bookmarks" WHERE "seriesId" = ${data.seriesId})`,
      this.prisma.$executeRaw`
        INSERT INTO "notifications" ("id", "userId", "type", "title", "body", "link", "refId", "count", "read", "createdAt")
        SELECT gen_random_uuid()::text, b."userId", 'chapter', ${data.title}, ${data.firstBody}, ${data.link}, ${data.seriesId}, 1, false, now()
        FROM "bookmarks" b
        JOIN "users" u ON u."id" = b."userId" AND u."isBanned" = false
        WHERE b."seriesId" = ${data.seriesId}
          AND NOT EXISTS (
            SELECT 1 FROM "notifications" n
            WHERE n."userId" = b."userId" AND n."type" = 'chapter' AND n."refId" = ${data.seriesId} AND n."read" = false
          )`,
    ]);
  }

  findSeriesLabel(seriesId: string) {
    return this.prisma.series.findUnique({ where: { id: seriesId }, select: { slug: true, titleAr: true, titleEn: true, synopsis: true } });
  }

  findNewsLabel(newsId: string) {
    return this.prisma.newsItem.findUnique({ where: { id: newsId }, select: { title: true, excerpt: true, isPublished: true } });
  }
}
