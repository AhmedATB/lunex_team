import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { metAchievements, type AchievementValues } from "./achievements.defs";
import { walletConfig } from "../wallet/wallet.config";
import { ProgressRepository } from "./progress.repository";
import {
  applyEvent,
  currentStreak,
  dayKey,
  DAILY_XP_CAP,
  levelInfo,
  MIN_READ_SECONDS,
  previousDayKey,
  XP_RULES,
  type AwardResult,
  type ProgressEvent,
  type ProgressState,
} from "./progress.util";

/** What the reader is told about their own progression. */
export interface ProgressDto {
  /** Total experience. */
  xp: number;
  level: number;
  xpIntoLevel: number;
  levelSpan: number;
  xpToNext: number;
  streak: number;
  bestStreak: number;
  chaptersRead: number;
  comments: number;
  bookmarks: number;
  todayXp: number;
  dailyCap: number;
  /** Ids of the achievements earned so far. */
  achievements: string[];
}

export interface CompleteResult {
  /** Whether experience was added. */
  awarded: boolean;
  xpGained: number;
  leveledUp: boolean;
  /** Why nothing was added, when that is worth saying: the chapter was not opened, or finished implausibly fast. */
  reason?: "not_opened" | "too_fast" | "nothing_new";
  progress: ProgressDto;
}

/** The public face of an account's progression, for other people's eyes (no daily figures, no private counts). */
export interface PublicProgress {
  xp: number;
  level: number;
  xpIntoLevel: number;
  levelSpan: number;
  xpToNext: number;
  streak: number;
  bestStreak: number;
  chaptersRead: number;
  achievements: string[];
}

export function publicProgress(
  row: Pick<ProgressState, "xp" | "streakDays" | "bestStreak" | "streakLastDay" | "chaptersRead"> & { achievements: string[] },
  today: string
): PublicProgress {
  return {
    xp: row.xp,
    ...pickLevel(row.xp),
    streak: currentStreak(row, today),
    bestStreak: row.bestStreak,
    chaptersRead: row.chaptersRead,
    achievements: row.achievements,
  };
}

function pickLevel(xp: number) {
  const { level, xpIntoLevel, levelSpan, xpToNext } = levelInfo(xp);
  return { level, xpIntoLevel, levelSpan, xpToNext };
}

/**
 * Experience, levels, streaks and achievements. Everything is decided here from what the server itself saw — a chapter
 * opened (the view row), how long ago, how far the reader has already finished — never from a number the browser sends.
 */
@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);

  constructor(private readonly repo: ProgressRepository) {}

  async snapshot(userId: string, now: Date = new Date()): Promise<ProgressDto> {
    const state = await this.repo.getState(userId);
    if (!state) throw new NotFoundException({ code: "user_not_found", message: "Account not found." });
    return this.build(userId, state, now);
  }

  /** The reader reached the end of a chapter. */
  async completeChapter(userId: string, chapterId: string, now: Date = new Date()): Promise<CompleteResult> {
    const chapter = await this.repo.findPublishedChapter(chapterId);
    if (!chapter) throw new NotFoundException({ code: "chapter_not_found", message: "Chapter not found." });

    const today = dayKey(now);
    const view = await this.repo.findRecentView(chapter.id, userId, new Date(`${previousDayKey(today)}T00:00:00.000Z`));
    if (!view) return this.declined("not_opened", userId, now);
    if (now.getTime() - view.createdAt.getTime() < MIN_READ_SECONDS * 1000) return this.declined("too_fast", userId, now);

    const forward = await this.repo.advanceCompleted(userId, chapter.seriesId, chapter.number);
    const outcome = await this.apply(userId, { type: "chapter", forward }, now);
    const progress = await this.snapshot(userId, now);
    return {
      awarded: (outcome?.granted ?? 0) > 0,
      xpGained: outcome?.granted ?? 0,
      leveledUp: outcome?.leveledUp ?? false,
      ...(forward || outcome?.newStreakDay ? {} : { reason: "nothing_new" as const }),
      progress,
    };
  }

  /** A comment was posted. Never throws: a hiccup here must not undo the comment. */
  async awardComment(userId: string, now: Date = new Date()): Promise<void> {
    try {
      const startOfDay = new Date(`${dayKey(now)}T00:00:00.000Z`);
      const today = await this.repo.countCommentsSince(userId, startOfDay);
      await this.apply(userId, { type: "comment", earnsXp: today <= XP_RULES.commentsPerDay }, now);
      await this.refreshAchievements(userId, now);
    } catch (err) {
      this.logger.warn(`comment experience failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  /** A series was rated for the first time. Never throws, like awardComment. */
  async awardRating(userId: string, now: Date = new Date()): Promise<void> {
    try {
      await this.apply(userId, { type: "rating" }, now);
    } catch (err) {
      this.logger.warn(`rating experience failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  private apply(userId: string, event: ProgressEvent, now: Date): Promise<AwardResult | null> {
    const today = dayKey(now);
    return this.repo.transact(userId, (state) => {
      const result = applyEvent(state, event, today, walletConfig().chaptersPerCredit);
      return { next: result.next, result };
    });
  }

  private async declined(reason: "not_opened" | "too_fast", userId: string, now: Date): Promise<CompleteResult> {
    return { awarded: false, xpGained: 0, leveledUp: false, reason, progress: await this.snapshot(userId, now) };
  }

  private async build(userId: string, state: ProgressState, now: Date): Promise<ProgressDto> {
    const today = dayKey(now);
    const [comments, bookmarks, earned] = await Promise.all([this.repo.countComments(userId), this.repo.countBookmarks(userId), this.repo.getAchievements(userId)]);
    const level = levelInfo(state.xp);
    const values: AchievementValues = { chaptersRead: state.chaptersRead, comments, bookmarks, streak: state.bestStreak, level: level.level };
    const missing = metAchievements(values).filter((id) => !earned.includes(id));
    const achievements = missing.length > 0 ? await this.repo.addAchievements(userId, missing) : earned;

    return {
      xp: state.xp,
      level: level.level,
      xpIntoLevel: level.xpIntoLevel,
      levelSpan: level.levelSpan,
      xpToNext: level.xpToNext,
      streak: currentStreak(state, today),
      bestStreak: state.bestStreak,
      chaptersRead: state.chaptersRead,
      comments,
      bookmarks,
      todayXp: state.xpDay === today ? state.xpDayGain : 0,
      dailyCap: DAILY_XP_CAP,
      achievements,
    };
  }

  private async refreshAchievements(userId: string, now: Date): Promise<void> {
    const state = await this.repo.getState(userId);
    if (state) await this.build(userId, state, now);
  }
}

