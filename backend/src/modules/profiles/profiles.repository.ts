import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ProfilesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** No avatar bytes here — `avatarMimeType` being set is enough to know an avatar exists. */
  findProfileByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        avatarMimeType: true,
        profileVisibility: true,
        historyVisibility: true,
        favoritesVisibility: true,
      },
    });
  }

  /** The caller's current role, read fresh — a token can be up to 10 minutes stale. */
  findViewer(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  }

  updatePrivacy(
    userId: string,
    patch: { profileVisibility?: string; historyVisibility?: string; favoritesVisibility?: string }
  ) {
    return this.prisma.user.update({ where: { id: userId }, data: patch });
  }

  listBookmarks(userId: string, take: number) {
    return this.prisma.bookmark.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
      select: { seriesId: true },
    });
  }

  countBookmarks(userId: string) {
    return this.prisma.bookmark.count({ where: { userId } });
  }

  listProgress(userId: string, take: number) {
    return this.prisma.readingProgress.findMany({
      where: { userId },
      orderBy: { lastReadAt: "desc" },
      take,
      select: { seriesId: true, chapterNumber: true, lastReadAt: true },
    });
  }

  addBookmark(userId: string, seriesId: string) {
    return this.prisma.bookmark.upsert({
      where: { userId_seriesId: { userId, seriesId } },
      update: {},
      create: { userId, seriesId },
    });
  }

  removeBookmark(userId: string, seriesId: string) {
    return this.prisma.bookmark.deleteMany({ where: { userId, seriesId } });
  }

  /**
   * Single-statement upsert so "only ever advances" holds even when two tabs
   * report at once — a read-then-write in application code could let a lower
   * chapter overwrite a higher one.
   */
  upsertProgress(userId: string, seriesId: string, chapterNumber: number) {
    return this.prisma.$executeRaw`
      INSERT INTO reading_progress ("id", "userId", "seriesId", "chapterNumber", "lastReadAt")
      VALUES (gen_random_uuid()::text, ${userId}, ${seriesId}, ${chapterNumber}, now())
      ON CONFLICT ("userId", "seriesId") DO UPDATE
      SET "chapterNumber" = GREATEST(reading_progress."chapterNumber", EXCLUDED."chapterNumber"),
          "lastReadAt" = now()`;
  }

  /** Merges a local library into the account in one transaction: the union of favorites, and the furthest chapter per series. */
  async mergeLibrary(userId: string, seriesIds: string[], progress: [string, number][]) {
    await this.prisma.$transaction([
      this.prisma.bookmark.createMany({
        data: seriesIds.map((seriesId) => ({ userId, seriesId })),
        skipDuplicates: true,
      }),
      ...progress.map(([seriesId, chapterNumber]) => this.upsertProgress(userId, seriesId, chapterNumber)),
    ]);
  }
}
