-- AlterTable
ALTER TABLE "chapters" ADD COLUMN     "externalId" TEXT;

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isInactive" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "series" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "altTitles" JSONB,
    "descriptionAr" TEXT,
    "descriptionEn" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ongoing',
    "originalLanguage" TEXT,
    "contentRating" TEXT,
    "publicationDemographic" TEXT,
    "year" INTEGER,
    "coverImage" BYTEA,
    "coverMimeType" TEXT,
    "teamId" TEXT,
    "tags" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_externalId_key" ON "teams"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "series_externalId_key" ON "series"("externalId");

-- CreateIndex
CREATE INDEX "series_teamId_idx" ON "series"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_externalId_key" ON "chapters"("externalId");

-- AddForeignKey
ALTER TABLE "series" ADD CONSTRAINT "series_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

