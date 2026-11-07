CREATE TYPE "AutoSubmitReason" AS ENUM ('timer', 'quiz_ended', 'quiz_deactivated');

ALTER TABLE "activities" ADD COLUMN "results_published_at" TIMESTAMPTZ(3);

ALTER TABLE "attempts" ADD COLUMN "auto_submit_reason" "AutoSubmitReason";
