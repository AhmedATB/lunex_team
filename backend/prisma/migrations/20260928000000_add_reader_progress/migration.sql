-- Reader progression: experience, streaks, finished-chapter count and earned achievements live on the account, and the
-- reading history remembers how far the reader has *finished* each series. Every column has a default, so this is safe
-- on a database that already has readers.
ALTER TABLE "users"
  ADD COLUMN "xp" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "xpDay" DATE,
  ADD COLUMN "xpDayGain" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "chaptersRead" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "streakDays" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bestStreak" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "streakLastDay" DATE,
  ADD COLUMN "achievements" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "reading_progress" ADD COLUMN "completedThrough" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Chapters a reader is already past count as finished, so nobody earns experience for what they read before this
-- existed; the chapter they are on still counts once they finish it.
UPDATE "reading_progress" SET "completedThrough" = GREATEST("chapterNumber" - 1, 0);
