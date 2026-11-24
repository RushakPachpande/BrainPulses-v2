-- Registration form: option-based assignment rules.
-- Existing forms keep working: they default to "all" (everyone gets the ticked activities).
-- Choice-field options stored as plain strings are converted to { id, label } when read
-- (see normalizeFields in api/src/modules/contest-forms/rules.ts), so no data is rewritten here.

CREATE TYPE "ContestAssignmentMode" AS ENUM ('all', 'rules');

ALTER TABLE "contest_registration_forms"
  ADD COLUMN "assignment_mode" "ContestAssignmentMode" NOT NULL DEFAULT 'all',
  ADD COLUMN "rules" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "fallback_activity_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
