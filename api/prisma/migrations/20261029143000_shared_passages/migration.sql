-- Shared reading passages. Questions point at one row; versions keep the
-- passage they were saved with so an attempt already underway does not change.

CREATE TABLE "passages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "bank_id" UUID NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "passages_organization_id_bank_id_idx" ON "passages"("organization_id", "bank_id");

ALTER TABLE "passages" ADD CONSTRAINT "passages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "passages" ADD CONSTRAINT "passages_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "question_banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "questions" ADD COLUMN "passage_id" UUID;
ALTER TABLE "questions" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "questions_passage_id_idx" ON "questions"("passage_id");
ALTER TABLE "questions" ADD CONSTRAINT "questions_passage_id_fkey" FOREIGN KEY ("passage_id") REFERENCES "passages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "question_versions" ADD COLUMN "passage_id" UUID;
CREATE INDEX "question_versions_passage_id_idx" ON "question_versions"("passage_id");
ALTER TABLE "question_versions" ADD CONSTRAINT "question_versions_passage_id_fkey" FOREIGN KEY ("passage_id") REFERENCES "passages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "passages" ("id", "organization_id", "bank_id", "body", "created_at", "updated_at")
SELECT gen_random_uuid(),
       q.organization_id,
       q.bank_id,
       btrim(qv.answer_key->>'passageText'),
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM "question_versions" qv
JOIN "questions" q ON q.id = qv.question_id
WHERE qv.type = 'comprehension_mcq'
  AND btrim(COALESCE(qv.answer_key->>'passageText', '')) <> ''
GROUP BY q.organization_id, q.bank_id, btrim(qv.answer_key->>'passageText');

UPDATE "question_versions" qv
SET "passage_id" = p.id
FROM "questions" q, "passages" p
WHERE q.id = qv.question_id
  AND p.organization_id = q.organization_id
  AND p.bank_id = q.bank_id
  AND p.body = btrim(qv.answer_key->>'passageText')
  AND qv.type = 'comprehension_mcq'
  AND btrim(COALESCE(qv.answer_key->>'passageText', '')) <> '';

UPDATE "questions" q
SET "passage_id" = latest.passage_id
FROM (
  SELECT DISTINCT ON (question_id) question_id, passage_id
  FROM "question_versions"
  WHERE passage_id IS NOT NULL
  ORDER BY question_id, version DESC
) latest
WHERE latest.question_id = q.id;

WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY passage_id ORDER BY created_at, id) - 1) AS ord
  FROM "questions"
  WHERE passage_id IS NOT NULL
)
UPDATE "questions" q
SET "sort_order" = ranked.ord
FROM ranked
WHERE ranked.id = q.id;

UPDATE "question_versions"
SET "answer_key" = "answer_key" - 'passageText'
WHERE "passage_id" IS NOT NULL
  AND "answer_key" ? 'passageText';
