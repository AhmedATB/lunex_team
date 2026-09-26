-- A work can belong to no team, so a chapter of it can be published without one.
ALTER TABLE "chapters" ALTER COLUMN "teamId" DROP NOT NULL;
