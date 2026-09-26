import { NotFoundException } from "@nestjs/common";
import type { ProgressRepository } from "./progress.repository";
import { ProgressService } from "./progress.service";
import type { ProgressState } from "./progress.util";

const NOW = new Date("2026-09-26T10:00:00.000Z");
const fresh: ProgressState = { xp: 0, xpDay: null, xpDayGain: 0, chaptersRead: 0, streakDays: 0, bestStreak: 0, streakLastDay: null, unlockCredits: 0, creditProgress: 0 };

/** An in-memory stand-in for the repository: one account whose numbers change through `transact`, like the real row. */
function build(opts: { view?: Date | null; forward?: boolean; state?: ProgressState; comments?: number; commentsToday?: number } = {}) {
  let state = { ...(opts.state ?? fresh) };
  let earned: string[] = [];
  const repo = {
    findPublishedChapter: jest.fn(async (id: string) => (id === "c1" ? { id: "c1", seriesId: "s1", number: 5 } : null)),
    findRecentView: jest.fn(async (_chapterId: string, _userId: string, _sinceDay: Date) => (opts.view === null ? null : { createdAt: opts.view ?? new Date(NOW.getTime() - 60_000) })),
    advanceCompleted: jest.fn(async () => opts.forward ?? true),
    getState: jest.fn(async () => ({ ...state })),
    transact: jest.fn(async (_id: string, change: (s: ProgressState) => { next: ProgressState; result: unknown }) => {
      const { next, result } = change({ ...state });
      state = next;
      return result;
    }),
    getAchievements: jest.fn(async () => earned),
    addAchievements: jest.fn(async (_id: string, ids: string[]) => (earned = [...new Set([...earned, ...ids])])),
    countComments: jest.fn(async () => opts.comments ?? 0),
    countCommentsSince: jest.fn(async () => opts.commentsToday ?? 1),
    countBookmarks: jest.fn(async () => 0),
  };
  return { service: new ProgressService(repo as unknown as ProgressRepository), repo, current: () => state };
}

describe("finishing a chapter", () => {
  it("pays the chapter and the day's bonus, and reports the new totals", async () => {
    const { service, repo } = build();
    const result = await service.completeChapter("u1", "c1", NOW);
    expect(result).toMatchObject({ awarded: true, xpGained: 20, leveledUp: false });
    expect(result.progress).toMatchObject({ xp: 20, chaptersRead: 1, streak: 1, todayXp: 20, level: 1 });
    expect(result.progress.achievements).toContain("first_chapter");
    expect(repo.advanceCompleted).toHaveBeenCalledWith("u1", "s1", 5);
  });

  it("refuses a chapter that does not exist", async () => {
    const { service } = build();
    await expect(service.completeChapter("u1", "nope", NOW)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("refuses a chapter that was never opened", async () => {
    const { service, repo } = build({ view: null });
    const result = await service.completeChapter("u1", "c1", NOW);
    expect(result).toMatchObject({ awarded: false, xpGained: 0, reason: "not_opened" });
    expect(repo.advanceCompleted).not.toHaveBeenCalled();
    expect(repo.transact).not.toHaveBeenCalled();
  });

  it("refuses a chapter finished implausibly fast", async () => {
    const { service, repo } = build({ view: new Date(NOW.getTime() - 5_000) });
    const result = await service.completeChapter("u1", "c1", NOW);
    expect(result).toMatchObject({ awarded: false, reason: "too_fast" });
    expect(repo.transact).not.toHaveBeenCalled();
  });

  it("accepts a chapter opened just before midnight and finished just after", async () => {
    const { service, repo } = build({ view: new Date("2026-09-25T23:59:30.000Z") });
    const result = await service.completeChapter("u1", "c1", new Date("2026-09-26T00:01:00.000Z"));
    expect(result.awarded).toBe(true);
    const sinceDay = repo.findRecentView.mock.calls[0][2];
    expect(sinceDay.toISOString()).toBe("2026-09-25T00:00:00.000Z"); // yesterday counts as recent
  });

  it("earns nothing more for re-finishing a chapter the reader had already finished, but says why", async () => {
    const already: ProgressState = { ...fresh, xp: 20, xpDay: "2026-09-26", xpDayGain: 20, chaptersRead: 1, streakDays: 1, bestStreak: 1, streakLastDay: "2026-09-26" };
    const { service } = build({ forward: false, state: already });
    const result = await service.completeChapter("u1", "c1", NOW);
    expect(result).toMatchObject({ awarded: false, xpGained: 0, reason: "nothing_new" });
    expect(result.progress.xp).toBe(20);
  });

  it("reports a level-up", async () => {
    const near: ProgressState = { ...fresh, xp: 90, xpDay: "2026-09-25", xpDayGain: 50, streakDays: 1, bestStreak: 1, streakLastDay: "2026-09-25" };
    const { service } = build({ state: near });
    const result = await service.completeChapter("u1", "c1", NOW);
    expect(result.leveledUp).toBe(true);
    expect(result.progress.level).toBe(2);
  });
});

describe("other awards", () => {
  it("pays a comment only while it is one of the day's first five", async () => {
    const first = build({ commentsToday: 5 });
    await first.service.awardComment("u1", NOW);
    expect(first.current().xp).toBe(5);

    const sixth = build({ commentsToday: 6 });
    await sixth.service.awardComment("u1", NOW);
    expect(sixth.current().xp).toBe(0);
  });

  it("pays a first rating", async () => {
    const { service, current } = build();
    await service.awardRating("u1", NOW);
    expect(current().xp).toBe(3);
  });

  it("never lets a failure here break the comment or rating", async () => {
    const { service, repo } = build();
    repo.transact.mockRejectedValue(new Error("database down"));
    await expect(service.awardComment("u1", NOW)).resolves.toBeUndefined();
    await expect(service.awardRating("u1", NOW)).resolves.toBeUndefined();
  });
});

describe("the reader's own numbers", () => {
  it("adds up levels, streak and today's earnings, and awards achievements once", async () => {
    const state: ProgressState = { ...fresh, xp: 320, xpDay: "2026-09-26", xpDayGain: 40, chaptersRead: 12, streakDays: 4, bestStreak: 4, streakLastDay: "2026-09-25" };
    const { service, repo } = build({ state, comments: 2 });
    const progress = await service.snapshot("u1", NOW);
    expect(progress).toMatchObject({ xp: 320, level: 3, xpIntoLevel: 20, levelSpan: 300, xpToNext: 280, streak: 4, bestStreak: 4, todayXp: 40, chaptersRead: 12, comments: 2 });
    expect(progress.achievements).toEqual(expect.arrayContaining(["first_chapter", "reader_10", "first_comment", "streak_3"]));
    await service.snapshot("u1", NOW);
    expect(repo.addAchievements).toHaveBeenCalledTimes(1); // the second look finds nothing new to add
  });

  it("does not show a streak that has been broken", async () => {
    const state: ProgressState = { ...fresh, streakDays: 6, bestStreak: 6, streakLastDay: "2026-09-20" };
    const { service } = build({ state });
    expect((await service.snapshot("u1", NOW)).streak).toBe(0);
    expect((await service.snapshot("u1", NOW)).bestStreak).toBe(6);
  });
});
