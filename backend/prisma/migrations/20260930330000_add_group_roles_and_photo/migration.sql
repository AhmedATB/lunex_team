-- AlterTable
ALTER TABLE "conversation_members" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'member';

-- CreateTable
CREATE TABLE "conversation_photos" (
    "conversationId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_photos_pkey" PRIMARY KEY ("conversationId")
);

-- AddForeignKey
ALTER TABLE "conversation_photos" ADD CONSTRAINT "conversation_photos_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

