-- Persist attempt cursor and closed (answered/skipped) questions for forward-only resume.
ALTER TABLE "attempts" ADD COLUMN "current_question_index" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "attempts" ADD COLUMN "closed_question_version_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
