-- CreateIndex
-- RetentionService deletes by age ("at" < cutoff) once a day; without these each
-- run would sequentially scan three tables that only ever grow.
CREATE INDEX "login_events_at_idx" ON "login_events"("at");

-- CreateIndex
CREATE INDEX "audit_log_at_idx" ON "audit_log"("at");

-- CreateIndex
CREATE INDEX "image_access_log_at_idx" ON "image_access_log"("at");
