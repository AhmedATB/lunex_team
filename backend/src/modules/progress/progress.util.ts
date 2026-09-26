/**
 * The rules of reader progression, kept free of the database so they can be read (and tested) on their own.
 *
 * What earns experience:
 *  - finishing a chapter that lies beyond how far the reader had already finished that series (re-reading earns nothing);
 *  - the first finished chapter of each UTC day earns a daily bonus that grows with the reading streak;
 *  - a comment (the first few each day) and a first rating of a series.
 * A daily ceiling caps everything, so no amount of clicking is worth more than a dedicated day of reading.
 */
export const XP_RULES = {
  /** Finishing a chapter beyond the reader's finished-through mark. */
  chapter: 10,
  /** The first finished chapter of a day. */
  dailyBase: 10,
  /** Added to the daily bonus for each earlier day of the current streak… */
  streakStep: 5,
  /** …up to this many earlier days (so the bonus tops out at 10 + 6×5 = 40). */
  streakSteps: 6,
  comment: 5,
  /** Only this many comments a day earn experience. */
  commentsPerDay: 5,
  /** Rating a series for the first time. */
  rating: 3,
} as const;

/** Everything a reader can earn in one UTC day: about thirty chapters, which is a very long day. */
export const DAILY_XP_CAP = 300;

/** A chapter cannot be finished sooner than this after it was opened. */
export const MIN_READ_SECONDS = 15;

/** Total experience needed to *reach* a level: 0, 100, 300, 600, 1000, … (each level costs 100 more than the last). */
export function xpToReach(level: number): number {
  return 50 * level * (level - 1);
}

export interface LevelInfo {
  level: number;
  /** Experience earned inside the current level. */
  xpIntoLevel: number;
  /** Experience the current level spans, from its start to the next level. */
  levelSpan: number;
  /** What is left to the next level. */
  xpToNext: number;
}

export function levelInfo(xp: number): LevelInfo {
  const total = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  // Solve 50·L·(L-1) ≤ xp for L, then correct for rounding at the boundaries.
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * total) / 50)) / 2));
  while (xpToReach(level) > total) level--;
  while (xpToReach(level + 1) <= total) level++;
  const levelSpan = xpToReach(level + 1) - xpToReach(level);
  const xpIntoLevel = total - xpToReach(level);
  return { level, xpIntoLevel, levelSpan, xpToNext: levelSpan - xpIntoLevel };
}

/** A UTC calendar day as `YYYY-MM-DD`, the way days are compared here. */
export function dayKey(moment: Date): string {
  return moment.toISOString().slice(0, 10);
}

export function previousDayKey(day: string): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return dayKey(d);
}

/** What the account remembers, with days as `YYYY-MM-DD` strings. */
export interface ProgressState {
  xp: number;
  xpDay: string | null;
  xpDayGain: number;
  chaptersRead: number;
  streakDays: number;
  bestStreak: number;
  streakLastDay: string | null;
}

export type ProgressEvent =
  /** A chapter was finished; `forward` says whether it lay beyond what the reader had already finished in that series. */
  | { type: "chapter"; forward: boolean }
  /** `earnsXp` — whether this is one of the day's first few comments. */
  | { type: "comment"; earnsXp: boolean }
  | { type: "rating" };

export interface AwardResult {
  next: ProgressState;
  /** Experience actually added (after the daily ceiling). */
  granted: number;
  /** True when this was the first finished chapter of the day. */
  newStreakDay: boolean;
  leveledUp: boolean;
}

/** Applies one event to the account's progress. Pure: the caller stores `next`. */
export function applyEvent(state: ProgressState, event: ProgressEvent, today: string): AwardResult {
  const next: ProgressState = { ...state };
  let gross = 0;
  let newStreakDay = false;

  if (event.type === "chapter") {
    if (state.streakLastDay !== today) {
      newStreakDay = true;
      next.streakDays = state.streakLastDay === previousDayKey(today) ? state.streakDays + 1 : 1;
      next.bestStreak = Math.max(state.bestStreak, next.streakDays);
      next.streakLastDay = today;
      gross += XP_RULES.dailyBase + Math.min(next.streakDays - 1, XP_RULES.streakSteps) * XP_RULES.streakStep;
    }
    if (event.forward) {
      next.chaptersRead = state.chaptersRead + 1;
      gross += XP_RULES.chapter;
    }
  } else if (event.type === "comment") {
    if (event.earnsXp) gross += XP_RULES.comment;
  } else {
    gross += XP_RULES.rating;
  }

  const earnedToday = state.xpDay === today ? state.xpDayGain : 0;
  const granted = Math.min(gross, Math.max(0, DAILY_XP_CAP - earnedToday));
  next.xp = state.xp + granted;
  next.xpDay = today;
  next.xpDayGain = earnedToday + granted;

  return { next, granted, newStreakDay, leveledUp: levelInfo(next.xp).level > levelInfo(state.xp).level };
}

/** The streak as it stands today: it survives a day without reading, and is over after two. */
export function currentStreak(state: Pick<ProgressState, "streakDays" | "streakLastDay">, today: string): number {
  if (!state.streakLastDay) return 0;
  return state.streakLastDay === today || state.streakLastDay === previousDayKey(today) ? state.streakDays : 0;
}
