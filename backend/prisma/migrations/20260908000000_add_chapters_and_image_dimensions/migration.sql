-- AlterTable
ALTER TABLE "image_assets" ADD COLUMN     "height" INTEGER NOT NULL,
ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "width" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "chapters" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "number" DOUBLE PRECISION NOT NULL,
    "title" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "scheduledFor" TIMESTAMP(3),
    "manualLock" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter_pages" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "assetId" TEXT NOT NULL,

    CONSTRAINT "chapter_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter_unlocks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapter_unlocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_blobs" (
    "storageKey" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_blobs_pkey" PRIMARY KEY ("storageKey")
);

-- CreateIndex
CREATE INDEX "chapters_seriesId_idx" ON "chapters"("seriesId");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_seriesId_number_key" ON "chapters"("seriesId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_pages_assetId_key" ON "chapter_pages"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_pages_chapterId_pageNumber_key" ON "chapter_pages"("chapterId", "pageNumber");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_unlocks_userId_chapterId_key" ON "chapter_unlocks"("userId", "chapterId");

-- AddForeignKey
ALTER TABLE "chapter_pages" ADD CONSTRAINT "chapter_pages_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_pages" ADD CONSTRAINT "chapter_pages_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "image_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_unlocks" ADD CONSTRAINT "chapter_unlocks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_unlocks" ADD CONSTRAINT "chapter_unlocks_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
