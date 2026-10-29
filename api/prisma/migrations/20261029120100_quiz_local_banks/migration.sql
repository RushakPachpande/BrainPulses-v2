-- A quiz that already has exactly one unshared bank keeps that bank as its private set.
UPDATE "question_banks" AS qb
SET "origin" = 'quiz_local'
WHERE qb."kind" = 'quiz'
  AND qb."origin" = 'reusable'
  AND (
    SELECT COUNT(*) FROM "activity_banks" ab WHERE ab."bank_id" = qb."id"
  ) = 1
  AND (
    SELECT COUNT(*)
    FROM "activity_banks" ab
    JOIN "activities" a ON a."id" = ab."activity_id"
    WHERE ab."bank_id" = qb."id"
      AND a."kind" = 'quiz'
      AND (
        SELECT COUNT(*) FROM "activity_banks" ab2 WHERE ab2."activity_id" = a."id"
      ) = 1
  ) = 1;

-- Remaining quizzes get one private bank. Shared or multi-bank quizzes are copied
-- so existing question versions stay in place for past attempts.
DO $$
DECLARE
  quiz RECORD;
  src RECORD;
  ver RECORD;
  new_bank uuid;
  new_question uuid;
  new_version uuid;
BEGIN
  FOR quiz IN
    SELECT a."id", a."organization_id", a."name"
    FROM "activities" a
    WHERE a."kind" = 'quiz'
      AND NOT EXISTS (
        SELECT 1
        FROM "activity_banks" ab
        JOIN "question_banks" qb ON qb."id" = ab."bank_id"
        WHERE ab."activity_id" = a."id"
          AND qb."origin" = 'quiz_local'
      )
  LOOP
    new_bank := gen_random_uuid();
    INSERT INTO "question_banks" (
      "id", "organization_id", "kind", "code", "name", "presentation", "status",
      "origin", "created_at", "updated_at"
    ) VALUES (
      new_bank,
      quiz.organization_id,
      'quiz',
      'QL-' || replace(quiz.id::text, '-', ''),
      left(quiz.name, 180) || ' questions',
      'one_at_a_time',
      'active',
      'quiz_local',
      now(),
      now()
    );

    FOR src IN
      SELECT q.*
      FROM "questions" q
      JOIN "activity_banks" ab ON ab."bank_id" = q."bank_id"
      WHERE ab."activity_id" = quiz.id
    LOOP
      new_question := gen_random_uuid();
      INSERT INTO "questions" (
        "id", "organization_id", "bank_id", "code", "type", "question", "points",
        "is_active", "created_at", "updated_at"
      ) VALUES (
        new_question,
        src.organization_id,
        new_bank,
        src.code || '-' || substr(replace(src.id::text, '-', ''), 1, 8),
        src.type,
        src.question,
        src.points,
        src.is_active,
        now(),
        now()
      );

      FOR ver IN
        SELECT * FROM "question_versions" v WHERE v."question_id" = src.id ORDER BY v."version"
      LOOP
        new_version := gen_random_uuid();
        INSERT INTO "question_versions" (
          "id", "organization_id", "question_id", "version", "type", "question",
          "points", "answer_key", "created_at"
        ) VALUES (
          new_version,
          ver.organization_id,
          new_question,
          ver.version,
          ver.type,
          ver.question,
          ver.points,
          ver.answer_key,
          now()
        );
        INSERT INTO "question_options" (
          "id", "question_id", "question_version_id", "label", "body", "image_url",
          "sort_order", "is_correct"
        )
        SELECT
          gen_random_uuid(),
          new_question,
          new_version,
          o."label",
          o."body",
          o."image_url",
          o."sort_order",
          o."is_correct"
        FROM "question_options" o
        WHERE o."question_version_id" = ver.id;
      END LOOP;
    END LOOP;

    DELETE FROM "activity_banks" WHERE "activity_id" = quiz.id;
    INSERT INTO "activity_banks" (
      "id", "organization_id", "activity_id", "bank_id", "created_at"
    ) VALUES (
      gen_random_uuid(),
      quiz.organization_id,
      quiz.id,
      new_bank,
      now()
    );
  END LOOP;
END $$;
