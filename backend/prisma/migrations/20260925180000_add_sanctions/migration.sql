-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bannedUntil" TIMESTAMP(3),
ADD COLUMN     "mutedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "sanctions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,

    CONSTRAINT "sanctions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sanctions_userId_createdAt_idx" ON "sanctions"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "sanctions" ADD CONSTRAINT "sanctions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

