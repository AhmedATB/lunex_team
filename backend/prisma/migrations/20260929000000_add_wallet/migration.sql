-- Wallet: coins (bought) and unlock credits (earned by reading) live on the account and are spent, on the server, to open
-- a locked chapter. All columns are defaulted, so this is safe on a database that already has members.
ALTER TABLE "users"
  ADD COLUMN "coins" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "unlockCredits" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "creditProgress" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "chapter_unlocks" ADD COLUMN "method" TEXT NOT NULL DEFAULT 'legacy';

CREATE TABLE "coin_transactions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "chapterId" TEXT,
  "actorId" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "coin_transactions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "coin_transactions_userId_createdAt_idx" ON "coin_transactions"("userId", "createdAt");
CREATE INDEX "coin_transactions_createdAt_idx" ON "coin_transactions"("createdAt");
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The lock is real from now on. Chapters imported from the old site were marked "force open" only because that site had
-- no locks; let them follow the automatic rule (the newest few chapters of a series are locked) like any other chapter.
UPDATE "chapters" SET "manualLock" = NULL WHERE "manualLock" = false AND "legacyId" IS NOT NULL;

-- Readers who already have finished chapters get the unlock credits those chapters earn (one per 10), and the remainder as
-- progress toward the next one.
UPDATE "users" SET "unlockCredits" = "chaptersRead" / 10, "creditProgress" = "chaptersRead" % 10 WHERE "chaptersRead" > 0;
