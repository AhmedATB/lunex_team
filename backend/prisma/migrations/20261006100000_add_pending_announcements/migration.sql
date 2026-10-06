-- CreateTable
CREATE TABLE "pending_announcements" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "numbers" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "dueAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pending_announcements_dueAt_idx" ON "pending_announcements"("dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "pending_announcements_kind_seriesId_key" ON "pending_announcements"("kind", "seriesId");
