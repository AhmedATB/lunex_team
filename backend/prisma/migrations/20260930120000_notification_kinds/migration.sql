-- What a notification is about, and how many events it stands for, so that several new chapters of one series
-- fold into a single row instead of one notification each. Existing rows keep count 1 and no reference.
ALTER TABLE "notifications" ADD COLUMN "refId" TEXT;
ALTER TABLE "notifications" ADD COLUMN "count" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "notifications_userId_type_refId_read_idx" ON "notifications"("userId", "type", "refId", "read");
