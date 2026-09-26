import { metAchievements } from "./achievements.defs";
import { applyEvent, currentStreak, DAILY_XP_CAP, levelInfo, previousDayKey, xpToReach, XP_RULES, type ProgressState } from "./progress.util";

const TODAY = "2026-09-26";

const fresh: ProgressState = { xp: 0, xpDay: null, xpDayGain: 0, chaptersRead: 0, streakDays: 0, bestStreak: 0, streakLastDay: null };

describe("levels", () => {
  it("cost a hundred more each time: 0, 100, 300, 600, 1000 ...", () => {
    expect([1, 2, 3, 4, 5, 10].map(xpToReach)).toEqual([0, 100, 300, 600, 1000, 4500]);
  });

  it("are worked out from the total, exactly at the boundaries", () => {
    expect(levelInfo(0)).toMatchObject({ level: 1, xpIntoLevel: 0, levelSpan: 100, xpToNext: 100 });
    expect(levelInfo(99)).toMatchObject({ level: 1, xpIntoLevel: 99, xpToNext: 1 });
    expect(levelInfo(100)).toMatchObject({ level: 2, xpIntoLevel: 0, levelSpan: 200, xpToNext: 200 });
    expect(levelInfo(299).level).toBe(2);
    expect(levelInfo(300).level).toBe(3);
    expect(levelInfo(4499).level).toBe(9);
    expect(levelInfo(4500).level).toBe(10);
  });

  it("agree with the cost table for every level up to 200", () => {
    for (let level = 1; level <= 200; level++) {
      expect(levelInfo(xpToReach(level)).level).toBe(level);
      expect(levelInfo(xpToReach(level + 1) - 1).level).toBe(level);
    }
  });

  it("never go below 1 for a strange total", () => {
    expect(levelInfo(-50).level).toBe(1);
    expect(levelInfo(Number.NaN).level).toBe(1);
  });
});

describe("finishing a chapter", () => {
  it("earns the chapter and the first-of-the-day bonus", () => {
    const { next, granted, newStreakDay } = applyEvent(fresh, { type: "chapter", forward: true }, TODAY);
    expect(granted).toBe(XP_RULES.chapter + XP_RULES.dailyBase);
    expect(newStreakDay).toBe(true);
    expect(next).toMatchObject({ xp: 20, chaptersRead: 1, streakDays: 1, bestStreak: 1, streakLastDay: TODAY, xpDay: TODAY, xpDayGain: 20 });
  });

  it("earns only the chapter for the second one that day — no second bonus", () => {
    const first = applyEvent(fresh, { type: "chapter", forward: true }, TODAY).next;
    const second = applyEvent(first, { type: "chapter", forward: true }, TODAY);
    expect(second.granted).toBe(XP_RULES.chapter);
    expect(second.newStreakDay).toBe(false);
    expect(second.next.chaptersRead).toBe(2);
    expect(second.next.streakDays).toBe(1);
  });

  it("earns nothing for a chapter that is not beyond what was finished — but still counts as a day of reading", () => {
    const { next, granted, newStreakDay } = applyEvent(fresh, { type: "chapter", forward: false }, TODAY);
    expect(newStreakDay).toBe(true);
    expect(next.chaptersRead).toBe(0);
    expect(granted).toBe(XP_RULES.dailyBase); // the day's bonus, no chapter XP
    const again = applyEvent(next, { type: "chapter", forward: false }, TODAY);
    expect(again.granted).toBe(0);
  });

  it("grows the daily bonus with the streak, up to a limit", () => {
    let state: ProgressState = { ...fresh };
    const seen: number[] = [];
    for (let day = 0; day < 10; day++) {
      const date = new Date(Date.UTC(2026, 8, 1 + day)).toISOString().slice(0, 10);
      const result = applyEvent(state, { type: "chapter", forward: false }, date);
      seen.push(result.granted);
      state = result.next;
    }
    expect(seen).toEqual([10, 15, 20, 25, 30, 35, 40, 40, 40, 40]);
    expect(state).toMatchObject({ streakDays: 10, bestStreak: 10 });
  });

  it("restarts the streak after a missed day but remembers the best", () => {
    const monday = applyEvent({ ...fresh, streakDays: 4, bestStreak: 4, streakLastDay: "2026-09-20" }, { type: "chapter", forward: true }, "2026-09-22");
    expect(monday.next).toMatchObject({ streakDays: 1, bestStreak: 4 });
  });

  it("carries the streak over a day boundary and a month boundary", () => {
    const next = applyEvent({ ...fresh, streakDays: 2, bestStreak: 2, streakLastDay: "2026-08-31" }, { type: "chapter", forward: true }, "2026-09-01");
    expect(next.next).toMatchObject({ streakDays: 3, bestStreak: 3 });
    expect(previousDayKey("2026-03-01")).toBe("2026-02-28");
  });
});

describe("the daily ceiling", () => {
  it("stops earning once the day's ceiling is reached", () => {
    let state: ProgressState = { ...fresh, xpDay: TODAY, xpDayGain: DAILY_XP_CAP - 5, xp: 1000, streakLastDay: TODAY, streakDays: 1 };
    const partial = applyEvent(state, { type: "chapter", forward: true }, TODAY);
    expect(partial.granted).toBe(5);
    expect(partial.next.xpDayGain).toBe(DAILY_XP_CAP);
    state = partial.next;
    expect(applyEvent(state, { type: "chapter", forward: true }, TODAY).granted).toBe(0);
    expect(applyEvent(state, { type: "rating" }, TODAY).granted).toBe(0);
  });

  it("starts fresh the next day", () => {
    const capped: ProgressState = { ...fresh, xpDay: "2026-09-25", xpDayGain: DAILY_XP_CAP, xp: 5000 };
    expect(applyEvent(capped, { type: "chapter", forward: true }, TODAY).granted).toBeGreaterThan(0);
  });

  it("still counts the chapter as read when the ceiling has been reached", () => {
    const capped: ProgressState = { ...fresh, xpDay: TODAY, xpDayGain: DAILY_XP_CAP, xp: 5000, streakLastDay: TODAY, streakDays: 1 };
    const result = applyEvent(capped, { type: "chapter", forward: true }, TODAY);
    expect(result.granted).toBe(0);
    expect(result.next.chaptersRead).toBe(1);
  });
});

describe("other ways to earn", () => {
  it("gives a comment its experience only while it is one of the day's first few", () => {
    expect(applyEvent(fresh, { type: "comment", earnsXp: true }, TODAY).granted).toBe(XP_RULES.comment);
    expect(applyEvent(fresh, { type: "comment", earnsXp: false }, TODAY).granted).toBe(0);
  });

  it("gives a first rating its experience", () => {
    expect(applyEvent(fresh, { type: "rating" }, TODAY).granted).toBe(XP_RULES.rating);
  });

  it("reports a level-up", () => {
    const almost: ProgressState = { ...fresh, xp: 95, xpDay: TODAY, xpDayGain: 0 };
    expect(applyEvent(almost, { type: "rating" }, TODAY).leveledUp).toBe(false); // 98
    expect(applyEvent({ ...almost, xp: 98 }, { type: "rating" }, TODAY).leveledUp).toBe(true); // 101
  });
});

describe("the streak as it stands", () => {
  it("survives one day without reading and is over after two", () => {
    const state = { streakDays: 5, streakLastDay: "2026-09-25" };
    expect(currentStreak(state, "2026-09-25")).toBe(5);
    expect(currentStreak(state, "2026-09-26")).toBe(5);
    expect(currentStreak(state, "2026-09-27")).toBe(0);
    expect(currentStreak({ streakDays: 0, streakLastDay: null }, TODAY)).toBe(0);
  });
});

describe("achievements", () => {
  it("are earned when a target is met, by metric", () => {
    expect(metAchievements({ chaptersRead: 0, comments: 0, bookmarks: 0, streak: 0, level: 1 })).toEqual([]);
    expect(metAchievements({ chaptersRead: 10, comments: 1, bookmarks: 0, streak: 3, level: 5 })).toEqual(
      expect.arrayContaining(["first_chapter", "reader_10", "first_comment", "streak_3", "level_5"])
    );
    expect(metAchievements({ chaptersRead: 10, comments: 1, bookmarks: 0, streak: 3, level: 5 })).not.toContain("reader_50");
  });
});
