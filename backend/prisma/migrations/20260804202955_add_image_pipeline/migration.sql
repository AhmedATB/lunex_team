-- CreateTable
CREATE TABLE "image_assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storageKey" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "image_access_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceFingerprint" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "reason" TEXT,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "image_access_log_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "image_assets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "image_assets_storageKey_key" ON "image_assets"("storageKey");

-- CreateIndex
CREATE INDEX "image_access_log_assetId_at_idx" ON "image_access_log"("assetId", "at");

-- CreateIndex
CREATE INDEX "image_access_log_userId_at_idx" ON "image_access_log"("userId", "at");
