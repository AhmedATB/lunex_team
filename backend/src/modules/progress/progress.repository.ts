import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { ProgressState } from "./progress.util";

const STATE_SELECT = {
  xp: true,
  xpDay: true,
  xpDayGain: true,
  chaptersRead: true,
  streakDays: true,
  bestStreak: true,
  streakLastDay: true,
} as const;

type StateRow = Prisma.UserGetPayload<{ select: typeof STATE_SELECT }>;

const dayString = (day: Date | null): string | null => (day ? day.toISOString().slice(0, 10) : null);
const dayDate = (day: string | null): Date | null => (day ? new Date(`${day}T00:00:00.000Z`) : null);

export function toState(row: StateRow): ProgressState {
  return {
    xp: row.xp,
    xpDay: dayString(row.xpDay),
    xpDayGain: row.xpDayGain,
    chaptersRead: row.chaptersRead,
    streakDays: row.streakDays,
    bestStreak: row.bestStreak,
    streakLastDay: dayString(row.streakLastDay),
  };
}

@Injectable()
export class ProgressRepository {
  constructor(private readonly prisma: PrismaService) {}

  findPublishedChapter(id: string) {
    return this.prisma.chapter.findFirst({ where: { id, isPublished: true }, select: { id: true, seriesId: true, number: true } });
  }

  /** The reader's latest opening of this chapter since `sinceDay` (yesterday covers a chapter opened just before midnight). */
  findRecentView(chapterId: string, userId: string, sinceDay: Date) {
    return this.prisma.chapterView.findFirst({
      where: { chapterId, userId, day: { gte: sinceDay } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
  }

  /**
   * Moves the "finished through" mark of a series forward to `chapterNumber`. True when it moved — that is, when this
   * chapter lay beyond everything the reader had finished there. The update is conditional on the old value, so two
   * requests for the same chapter cannot both win.
   */
  async advanceCompleted(userId: string, seriesId: string, chapterNumber: number): Promise<boolean> {
    const moved = await this.prisma.readingProgress.updateMany({
      where: { userId, seriesId, completedThrough: { lt: chapterNumber } },
      data: { completedThrough: chapterNumber },
    });
    if (moved.count > 0) return true;

    const existing = await this.prisma.readingProgress.findUnique({ where: { userId_seriesId: { userId, seriesId } }, select: { id: true } });
    if (existing) return false; // the row is there and already at or past this chapter

    try {
      await this.prisma.readingProgress.create({ data: { userId, seriesId, chapterNumber, completedThrough: chapterNumber } });
      return true;
    } catch (err) {
      // Another request created the row a moment ago (P2002): try the conditional move once more.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const retry = await this.prisma.readingProgress.updateMany({
          where: { userId, seriesId, completedThrough: { lt: chapterNumber } },
          data: { completedThrough: chapterNumber },
        });
        return retry.count > 0;
      }
      throw err;
    }
  }

  async getState(userId: string): Promise<ProgressState | null> {
    const row = await this.prisma.user.findUnique({ where: { id: userId }, select: STATE_SELECT });
    return row ? toState(row) : null;
  }

  /**
   * Reads the account's progress under a row lock, lets `change` decide the new state, and stores it — so two
   * simultaneous events cannot both start from the same numbers and lose one of the awards. Null if the account is gone.
   */
  transact<T>(userId: string, change: (state: ProgressState) => { next: ProgressState; result: T }): Promise<T | null> {
    return this.prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
        if (locked.length === 0) return null;
        const row = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: STATE_SELECT });
        const { next, result } = change(toState(row));
        await tx.user.update({
          where: { id: userId },
          data: {
            xp: next.xp,
            xpDay: dayDate(next.xpDay),
            xpDayGain: next.xpDayGain,
            chaptersRead: next.chaptersRead,
            streakDays: next.streakDays,
            bestStreak: next.bestStreak,
            streakLastDay: dayDate(next.streakLastDay),
          },
        });
        return result;
      },
      { timeout: 10_000 }
    );
  }

  async getAchievements(userId: string): Promise<string[]> {
    const row = await this.prisma.user.findUnique({ where: { id: userId }, select: { achievements: true } });
    return row?.achievements ?? [];
  }

  /** Adds ids to the earned list without ever removing one, atomically (two evaluations at once cannot drop each other's). */
  async addAchievements(userId: string, ids: string[]): Promise<string[]> {
    if (ids.length === 0) return this.getAchievements(userId);
    const rows = await this.prisma.$queryRaw<{ achievements: string[] }[]>`
      UPDATE users
      SET achievements = ARRAY(SELECT DISTINCT unnest(achievements || ${ids}::text[]))
      WHERE id = ${userId}
      RETURNING achievements`;
    return rows[0]?.achievements ?? [];
  }

  countComments(userId: string) {
    return this.prisma.comment.count({ where: { userId, deletedAt: null } });
  }

  countCommentsSince(userId: string, since: Date) {
    return this.prisma.comment.count({ where: { userId, createdAt: { gte: since } } });
  }

  countBookmarks(userId: string) {
    return this.prisma.bookmark.count({ where: { userId } });
  }
}
