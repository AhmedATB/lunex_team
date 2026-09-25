-- AlterTable
ALTER TABLE "users" ADD COLUMN     "favoritesVisibility" TEXT NOT NULL DEFAULT 'private',
ADD COLUMN     "historyVisibility" TEXT NOT NULL DEFAULT 'private',
ADD COLUMN     "profileVisibility" TEXT NOT NULL DEFAULT 'public';

-- CreateTable
CREATE TABLE "bookmarks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "chapterNumber" DOUBLE PRECISION NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reading_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bookmarks_userId_createdAt_idx" ON "bookmarks"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_userId_seriesId_key" ON "bookmarks"("userId", "seriesId");

-- CreateIndex
CREATE INDEX "reading_progress_userId_lastReadAt_idx" ON "reading_progress"("userId", "lastReadAt");

-- CreateIndex
CREATE UNIQUE INDEX "reading_progress_userId_seriesId_key" ON "reading_progress"("userId", "seriesId");

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

