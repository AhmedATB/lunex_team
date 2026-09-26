-- Tags this platform does not carry (Boys' Love, Girls' Love, Loli). Their links to series go with them
-- (series_tags.tagId is ON DELETE CASCADE); the series themselves are untouched. Safe to run on any data: on a
-- database without these tags it deletes nothing.
DELETE FROM "tags"
WHERE "slug" IN ('boys-love', 'girls-love', 'loli')
   OR "nameEn" IN ('Boys'' Love', 'Girls'' Love', 'Loli');
