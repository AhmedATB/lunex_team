-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_image_access_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceFingerprint" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "reason" TEXT,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_image_access_log" ("assetId", "at", "deviceFingerprint", "event", "id", "ip", "reason", "userId") SELECT "assetId", "at", "deviceFingerprint", "event", "id", "ip", "reason", "userId" FROM "image_access_log";
DROP TABLE "image_access_log";
ALTER TABLE "new_image_access_log" RENAME TO "image_access_log";
CREATE INDEX "image_access_log_assetId_at_idx" ON "image_access_log"("assetId", "at");
CREATE INDEX "image_access_log_userId_at_idx" ON "image_access_log"("userId", "at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
