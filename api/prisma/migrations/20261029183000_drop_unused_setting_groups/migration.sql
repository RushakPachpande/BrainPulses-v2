-- Remove access / notifications / system settings rows and narrow SettingGroup to general.

DELETE FROM "settings"
WHERE "group"::text IN ('access', 'notifications', 'system');

CREATE TYPE "SettingGroup_new" AS ENUM ('general');

ALTER TABLE "settings"
  ALTER COLUMN "group" TYPE "SettingGroup_new"
  USING ("group"::text::"SettingGroup_new");

DROP TYPE "SettingGroup";

ALTER TYPE "SettingGroup_new" RENAME TO "SettingGroup";
