-- Rename ActorType enum value
ALTER TYPE "ActorType" RENAME VALUE 'student' TO 'participant';

-- Rename students table and its indexes / constraints
ALTER TABLE "students" RENAME TO "participants";
ALTER INDEX "students_pkey" RENAME TO "participants_pkey";
ALTER INDEX "students_organization_id_is_active_idx" RENAME TO "participants_organization_id_is_active_idx";
ALTER INDEX "students_organization_id_name_idx" RENAME TO "participants_organization_id_name_idx";
ALTER INDEX "students_organization_id_code_key" RENAME TO "participants_organization_id_code_key";
ALTER INDEX "students_organization_id_email_key" RENAME TO "participants_organization_id_email_key";
ALTER INDEX "students_organization_id_phone_key" RENAME TO "participants_organization_id_phone_key";
ALTER INDEX "students_organization_id_cohort_idx" RENAME TO "participants_organization_id_cohort_idx";
ALTER TABLE "participants" RENAME CONSTRAINT "students_organization_id_fkey" TO "participants_organization_id_fkey";

-- Registration: student_id -> participant_id
ALTER TABLE "registrations" RENAME COLUMN "student_id" TO "participant_id";
ALTER INDEX "registrations_organization_id_student_id_idx" RENAME TO "registrations_organization_id_participant_id_idx";
ALTER INDEX "registrations_organization_id_activity_id_student_id_key" RENAME TO "registrations_organization_id_activity_id_participant_id_key";
ALTER TABLE "registrations" RENAME CONSTRAINT "registrations_student_id_fkey" TO "registrations_participant_id_fkey";

-- Attempt: student_id -> participant_id
ALTER TABLE "attempts" RENAME COLUMN "student_id" TO "participant_id";
ALTER INDEX "attempts_organization_id_activity_id_student_id_status_idx" RENAME TO "attempts_organization_id_activity_id_participant_id_status_idx";
ALTER INDEX "attempts_organization_id_activity_id_round_id_student_id_status_idx" RENAME TO "attempts_organization_id_activity_id_round_id_participant_id_status_idx";
ALTER INDEX "attempts_organization_id_student_id_status_idx" RENAME TO "attempts_organization_id_participant_id_status_idx";
ALTER TABLE "attempts" RENAME CONSTRAINT "attempts_student_id_fkey" TO "attempts_participant_id_fkey";

-- ReattemptGrant: student_id -> participant_id
ALTER TABLE "reattempt_grants" RENAME COLUMN "student_id" TO "participant_id";
ALTER INDEX "reattempt_grants_organization_id_activity_id_student_id_consumed_at_idx" RENAME TO "reattempt_grants_organization_id_activity_id_participant_id_consumed_at_idx";
ALTER TABLE "reattempt_grants" RENAME CONSTRAINT "reattempt_grants_student_id_fkey" TO "reattempt_grants_participant_id_fkey";

-- Result: student_id -> participant_id
ALTER TABLE "results" RENAME COLUMN "student_id" TO "participant_id";
ALTER INDEX "results_organization_id_student_id_idx" RENAME TO "results_organization_id_participant_id_idx";
ALTER TABLE "results" RENAME CONSTRAINT "results_student_id_fkey" TO "results_participant_id_fkey";

-- Portal page setting keys
UPDATE "settings"
SET "key" = REPLACE("key", 'studentPage', 'participantPage')
WHERE "key" LIKE 'studentPage%';

-- Audit target_type string values
UPDATE "audit_events"
SET "target_type" = 'participant'
WHERE "target_type" = 'student';

-- Quiz / assignment JSON keys inside activities.settings
UPDATE "activities"
SET "settings" = (("settings" - 'answersVisibleToStudent') || jsonb_build_object('answersVisibleToParticipant', "settings" -> 'answersVisibleToStudent'))
WHERE "settings" ? 'answersVisibleToStudent';

UPDATE "activities"
SET "settings" = jsonb_set("settings", '{assignmentRules,mode}', '"all_active_participants"')
WHERE ("settings" -> 'assignmentRules' ->> 'mode') = 'all_active_students';
