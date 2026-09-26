-- The owner chooses which works are pinned to the top of the home page, and in what order.
ALTER TABLE "series" ADD COLUMN "featuredOrder" INTEGER;

-- Works that were already featured keep a stable order: the most viewed first.
UPDATE "series" s
SET "featuredOrder" = ranked.position
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "viewCount" DESC, "createdAt" ASC) AS position
  FROM "series"
  WHERE "isFeatured" = true
) ranked
WHERE s."id" = ranked."id";
