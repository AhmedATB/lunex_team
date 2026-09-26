-- Recruitment on the server: the positions a team opens and the applications members send, instead of a copy in each browser.

CREATE TABLE "recruitment_positions" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recruitment_positions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recruitment_applications" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "positionId" TEXT,
    "userId" TEXT NOT NULL,
    "preferredRole" TEXT NOT NULL,
    "experience" TEXT NOT NULL,
    "portfolioUrl" TEXT,
    "languages" TEXT[],
    "availability" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "recruitment_applications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recruitment_positions_teamId_isOpen_idx" ON "recruitment_positions"("teamId", "isOpen");
CREATE INDEX "recruitment_applications_teamId_status_idx" ON "recruitment_applications"("teamId", "status");
CREATE INDEX "recruitment_applications_userId_createdAt_idx" ON "recruitment_applications"("userId", "createdAt");

ALTER TABLE "recruitment_positions" ADD CONSTRAINT "recruitment_positions_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recruitment_applications" ADD CONSTRAINT "recruitment_applications_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recruitment_applications" ADD CONSTRAINT "recruitment_applications_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "recruitment_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recruitment_applications" ADD CONSTRAINT "recruitment_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
