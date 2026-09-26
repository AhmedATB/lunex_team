-- Chapters published from the admin panel kept publishedAt empty, which sorted them last in the "latest chapters" list.
-- Date the ones already live from when they were created.
UPDATE "chapters" SET "publishedAt" = "createdAt" WHERE "isPublished" = true AND "publishedAt" IS NULL;
