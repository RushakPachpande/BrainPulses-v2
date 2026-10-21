-- Additive LevelUP-aligned question types + optional option image URL.
ALTER TYPE "QuestionType" ADD VALUE 'true_false';
ALTER TYPE "QuestionType" ADD VALUE 'long_text';
ALTER TYPE "QuestionType" ADD VALUE 'image_selection';
ALTER TYPE "QuestionType" ADD VALUE 'comprehension_mcq';

ALTER TABLE "question_options" ADD COLUMN IF NOT EXISTS "image_url" TEXT;
