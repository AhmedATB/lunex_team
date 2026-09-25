-- CreateTable
CREATE TABLE "chapter_views" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapter_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "series_ratings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "series_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chapter_views_seriesId_day_idx" ON "chapter_views"("seriesId", "day");

-- CreateIndex
CREATE INDEX "chapter_views_day_idx" ON "chapter_views"("day");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_views_chapterId_userId_day_key" ON "chapter_views"("chapterId", "userId", "day");

-- CreateIndex
CREATE INDEX "series_ratings_seriesId_idx" ON "series_ratings"("seriesId");

-- CreateIndex
CREATE UNIQUE INDEX "series_ratings_userId_seriesId_key" ON "series_ratings"("userId", "seriesId");

-- AddForeignKey
ALTER TABLE "chapter_views" ADD CONSTRAINT "chapter_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_ratings" ADD CONSTRAINT "series_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
