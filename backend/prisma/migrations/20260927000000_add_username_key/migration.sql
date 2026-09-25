-- AlterTable
ALTER TABLE "users" ADD COLUMN "usernameKey" TEXT;

-- Fold every existing username the same way the application does (see username.util.ts):
-- lower case, underscores dropped, 0->o, 1->l, i->l, 5->s. In a group of look-alikes only the oldest account
-- gets the key; a later one is left without it, so this can never fail on data that already exists.
UPDATE "users" u
SET "usernameKey" = ranked."key"
FROM (
  SELECT id, "key", row_number() OVER (PARTITION BY "key" ORDER BY "createdAt", id) AS place
  FROM (SELECT id, "createdAt", translate(lower("username"), '01i5_', 'olls') AS "key" FROM "users") folded
) ranked
WHERE u.id = ranked.id AND ranked.place = 1;

-- CreateIndex
CREATE UNIQUE INDEX "users_usernameKey_key" ON "users"("usernameKey");
