-- Align domain language: stem → question (UI + API).
ALTER TABLE "questions" RENAME COLUMN "stem" TO "question";
ALTER TABLE "question_versions" RENAME COLUMN "stem" TO "question";
