-- Collaboration between teams (requests and the collaborators an accepted one makes) and a team's activity log, on the server instead of in each leader's browser.
-- CreateTable
CREATE TABLE "team_collaborations" (
    "id" TEXT NOT NULL,
    "fromTeamId" TEXT NOT NULL,
    "toTeamId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdById" TEXT,
    "respondedById" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_collaborations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "series_collaborators" (
    "seriesId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "series_collaborators_pkey" PRIMARY KEY ("seriesId","teamId")
);

-- CreateTable
CREATE TABLE "team_activity" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "subjectId" TEXT,
    "detail" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_collaborations_toTeamId_status_idx" ON "team_collaborations"("toTeamId", "status");

-- CreateIndex
CREATE INDEX "team_collaborations_fromTeamId_createdAt_idx" ON "team_collaborations"("fromTeamId", "createdAt");

-- CreateIndex
CREATE INDEX "team_collaborations_seriesId_idx" ON "team_collaborations"("seriesId");

-- CreateIndex
CREATE INDEX "series_collaborators_teamId_idx" ON "series_collaborators"("teamId");

-- CreateIndex
CREATE INDEX "team_activity_teamId_at_idx" ON "team_activity"("teamId", "at");

-- AddForeignKey
ALTER TABLE "team_collaborations" ADD CONSTRAINT "team_collaborations_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_collaborations" ADD CONSTRAINT "team_collaborations_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_collaborations" ADD CONSTRAINT "team_collaborations_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_collaborators" ADD CONSTRAINT "series_collaborators_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_collaborators" ADD CONSTRAINT "series_collaborators_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_activity" ADD CONSTRAINT "team_activity_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_activity" ADD CONSTRAINT "team_activity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

