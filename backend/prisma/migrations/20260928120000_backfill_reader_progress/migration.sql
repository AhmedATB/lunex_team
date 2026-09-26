-- Readers lost their chapter count and achievements when progression moved from the browser to the server: the old
-- numbers only ever lived in each reader's localStorage, so the server started everyone at zero. This gives back what the
-- server itself can vouch for — the chapters each reader opened (chapter_views) before progression went live — so nothing
-- here can be claimed or inflated from the browser.
--
-- Credit = 10 experience per distinct chapter opened before that moment (no daily bonuses). The "finished through" mark of
-- each series is moved up to the furthest chapter opened, so those same chapters cannot pay a second time. Achievements
-- follow by themselves: they are worked out from these counts the next time the reader's numbers are read.
-- Runs once (a migration), so adding to the current values is safe; views made after progression went live already earned
-- their experience the normal way and are left out.
WITH went_live AS (
  SELECT COALESCE(
    (SELECT "finished_at" FROM "_prisma_migrations" WHERE "migration_name" = '20260928000000_add_reader_progress' AND "finished_at" IS NOT NULL LIMIT 1),
    NOW()
  ) AS at
),
opened AS (
  SELECT cv."userId" AS "userId", COUNT(DISTINCT cv."chapterId")::int AS n
  FROM "chapter_views" cv, went_live
  WHERE cv."createdAt" < went_live.at
  GROUP BY cv."userId"
)
UPDATE "users" u
SET "chaptersRead" = u."chaptersRead" + o.n,
    "xp" = u."xp" + o.n * 10
FROM opened o
WHERE u."id" = o."userId";

WITH went_live AS (
  SELECT COALESCE(
    (SELECT "finished_at" FROM "_prisma_migrations" WHERE "migration_name" = '20260928000000_add_reader_progress' AND "finished_at" IS NOT NULL LIMIT 1),
    NOW()
  ) AS at
),
furthest AS (
  SELECT cv."userId" AS "userId", cv."seriesId" AS "seriesId", MAX(c."number") AS num
  FROM "chapter_views" cv
  JOIN "chapters" c ON c."id" = cv."chapterId"
  CROSS JOIN went_live
  WHERE cv."createdAt" < went_live.at
  GROUP BY cv."userId", cv."seriesId"
)
UPDATE "reading_progress" rp
SET "completedThrough" = GREATEST(rp."completedThrough", f.num)
FROM furthest f
WHERE rp."userId" = f."userId" AND rp."seriesId" = f."seriesId";
