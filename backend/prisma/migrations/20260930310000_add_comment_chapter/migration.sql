-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "chapterId" TEXT,
ADD COLUMN     "chapterNumber" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "comments_seriesId_chapterId_createdAt_idx" ON "comments"("seriesId", "chapterId", "createdAt");

