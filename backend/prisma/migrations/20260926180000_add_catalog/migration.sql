-- The import experiment of 2026-09-09 (migration 20260909080000, since reverted in the code)
-- left tables named "teams" and "series" in the production database, in a different shape
-- (they have an "externalId" column). Move them aside, data and all, so the catalogue can
-- use those names. On a database that never had them this block does nothing.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'teams' AND column_name = 'externalId'
  ) THEN
    ALTER TABLE "teams" RENAME TO "legacy_import_teams";
    ALTER INDEX IF EXISTS "teams_pkey" RENAME TO "legacy_import_teams_pkey";
    ALTER INDEX IF EXISTS "teams_externalId_key" RENAME TO "legacy_import_teams_externalId_key";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'series' AND column_name = 'externalId'
  ) THEN
    ALTER TABLE "series" RENAME TO "legacy_import_series";
    ALTER INDEX IF EXISTS "series_pkey" RENAME TO "legacy_import_series_pkey";
    ALTER INDEX IF EXISTS "series_externalId_key" RENAME TO "legacy_import_series_externalId_key";
    ALTER INDEX IF EXISTS "series_teamId_idx" RENAME TO "legacy_import_series_teamId_idx";
  END IF;
END $$;

-- AlterTable
ALTER TABLE "chapters" ADD COLUMN     "content" TEXT,
ADD COLUMN     "legacyId" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "goals" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#6D28D9',
    "logoHue" INTEGER NOT NULL DEFAULT 270,
    "logoAssetId" TEXT,
    "discordUrl" TEXT,
    "websiteUrl" TEXT,
    "category" TEXT NOT NULL DEFAULT 'mixed',
    "status" TEXT NOT NULL DEFAULT 'active',
    "recruiting" BOOLEAN NOT NULL DEFAULT false,
    "leaderId" TEXT,
    "legacyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'translator',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("teamId","userId")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'genre',
    "legacyId" TEXT,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "series" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL DEFAULT '',
    "alternativeTitles" TEXT[],
    "synopsis" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'manhwa',
    "status" TEXT NOT NULL DEFAULT 'ongoing',
    "country" TEXT NOT NULL DEFAULT 'kr',
    "author" TEXT NOT NULL DEFAULT '',
    "artist" TEXT NOT NULL DEFAULT '',
    "year" INTEGER,
    "contentRating" TEXT NOT NULL DEFAULT 'safe',
    "coverAssetId" TEXT,
    "bannerAssetId" TEXT,
    "teamId" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isRecommended" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT 'approved',
    "legacyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "series_tags" (
    "seriesId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "series_tags_pkey" PRIMARY KEY ("seriesId","tagId")
);

-- CreateTable
CREATE TABLE "news_items" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "coverAssetId" TEXT,
    "category" TEXT NOT NULL DEFAULT 'news',
    "authorId" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_slug_key" ON "teams"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "teams_legacyId_key" ON "teams"("legacyId");

-- CreateIndex
CREATE INDEX "team_members_userId_idx" ON "team_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tags_legacyId_key" ON "tags"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "series_slug_key" ON "series"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "series_legacyId_key" ON "series"("legacyId");

-- CreateIndex
CREATE INDEX "series_teamId_idx" ON "series"("teamId");

-- CreateIndex
CREATE INDEX "series_updatedAt_idx" ON "series"("updatedAt");

-- CreateIndex
CREATE INDEX "series_tags_tagId_idx" ON "series_tags"("tagId");

-- CreateIndex
CREATE INDEX "news_items_createdAt_idx" ON "news_items"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_legacyId_key" ON "chapters"("legacyId");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series" ADD CONSTRAINT "series_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_tags" ADD CONSTRAINT "series_tags_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_tags" ADD CONSTRAINT "series_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Chapters published before this column existed keep their release date.
UPDATE "chapters" SET "publishedAt" = "createdAt" WHERE "isPublished" = true AND "publishedAt" IS NULL;
