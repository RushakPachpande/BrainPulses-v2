-- CreateEnum
CREATE TYPE "PassMode" AS ENUM ('percent', 'score');

-- AlterTable
ALTER TABLE "activity_rounds"
  ADD COLUMN "duration_mode" "DurationMode" NOT NULL DEFAULT 'overall',
  ADD COLUMN "per_question_seconds" INTEGER,
  ADD COLUMN "presentation" "PresentationMode" NOT NULL DEFAULT 'one_at_a_time',
  ADD COLUMN "pass_mode" "PassMode" NOT NULL DEFAULT 'percent',
  ADD COLUMN "passing_percent" DECIMAL(5,2),
  ADD COLUMN "passing_score" DECIMAL(12,2),
  ADD COLUMN "settings" JSONB;

-- Backfill defaults from parent activity where useful
UPDATE "activity_rounds" AS r
SET
  "duration_minutes" = COALESCE(r."duration_minutes", a."duration_minutes", 60),
  "passing_percent" = COALESCE(a."passing_percent", 40),
  "settings" = jsonb_build_object(
    'shuffleQuestions', true,
    'shuffleOptions', true,
    'allowPrevious', true,
    'showQuestionPanel', true,
    'questionsCompulsory', true,
    'negativeMarkingEnabled', false,
    'negativeMarkPoints', 0,
    'maxAttempts', 1
  )
FROM "activities" a
WHERE a."id" = r."activity_id"
  AND r."settings" IS NULL;
