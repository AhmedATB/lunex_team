-- A member's request to open a team, and the managers' decision on it, kept on the server instead of in the requester's browser.
-- CreateTable
CREATE TABLE "team_requests" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "goals" TEXT NOT NULL,
    "discordUrl" TEXT,
    "requiredPositions" TEXT[],
    "category" TEXT NOT NULL,
    "expectedMembers" INTEGER NOT NULL,
    "previousExperience" TEXT NOT NULL DEFAULT '',
    "portfolioUrl" TEXT,
    "logoUrl" TEXT,
    "color" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewerNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_requests_requesterId_createdAt_idx" ON "team_requests"("requesterId", "createdAt");

-- CreateIndex
CREATE INDEX "team_requests_status_createdAt_idx" ON "team_requests"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "team_requests" ADD CONSTRAINT "team_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

