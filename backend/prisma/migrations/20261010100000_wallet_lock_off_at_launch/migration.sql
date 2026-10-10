-- The first month every chapter is open to read: start with the automatic lock off (0 newest chapters locked), whatever the
-- environment says. From here on the owner changes it from the admin panel (site_settings key "wallet_config"); a row that
-- already exists is left alone.
INSERT INTO "site_settings" ("key", "value", "updatedAt")
VALUES ('wallet_config', '{"lockedWindow":0}', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
