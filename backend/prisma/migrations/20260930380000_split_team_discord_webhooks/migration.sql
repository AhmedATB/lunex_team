-- Splits the team's single Discord webhook into two independent optional ones: one for new chapters, one for new works.
-- Any team that already set the old webhook keeps it working for both, until they narrow it down themselves.
ALTER TABLE "teams" ADD COLUMN "discordChapterWebhookUrl" TEXT;
ALTER TABLE "teams" ADD COLUMN "discordSeriesWebhookUrl" TEXT;

UPDATE "teams"
SET "discordChapterWebhookUrl" = "discordWebhookUrl",
    "discordSeriesWebhookUrl" = "discordWebhookUrl"
WHERE "discordWebhookUrl" IS NOT NULL;

ALTER TABLE "teams" DROP COLUMN "discordWebhookUrl";
