-- Remap Timed card to one-at-a-time, then drop the enum value.
UPDATE "activities" SET "presentation" = 'one_at_a_time' WHERE "presentation" = 'timed_card';
UPDATE "question_banks" SET "presentation" = 'one_at_a_time' WHERE "presentation" = 'timed_card';

ALTER TYPE "PresentationMode" RENAME TO "PresentationMode_old";
CREATE TYPE "PresentationMode" AS ENUM ('one_at_a_time', 'all_on_page');

ALTER TABLE "activities" ALTER COLUMN "presentation" DROP DEFAULT;
ALTER TABLE "activities"
  ALTER COLUMN "presentation" TYPE "PresentationMode"
  USING ("presentation"::text::"PresentationMode");
ALTER TABLE "activities" ALTER COLUMN "presentation" SET DEFAULT 'one_at_a_time';

ALTER TABLE "question_banks" ALTER COLUMN "presentation" DROP DEFAULT;
ALTER TABLE "question_banks"
  ALTER COLUMN "presentation" TYPE "PresentationMode"
  USING ("presentation"::text::"PresentationMode");
ALTER TABLE "question_banks" ALTER COLUMN "presentation" SET DEFAULT 'one_at_a_time';

DROP TYPE "PresentationMode_old";
