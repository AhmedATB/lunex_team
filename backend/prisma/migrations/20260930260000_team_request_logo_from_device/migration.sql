-- AlterTable
ALTER TABLE "team_requests" DROP COLUMN "logoUrl";

-- CreateTable
CREATE TABLE "team_request_logos" (
    "requestId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_request_logos_pkey" PRIMARY KEY ("requestId")
);

-- AddForeignKey
ALTER TABLE "team_request_logos" ADD CONSTRAINT "team_request_logos_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "team_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

