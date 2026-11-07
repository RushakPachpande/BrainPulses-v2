-- Contest registration forms, and participant identity changes they require.

ALTER TABLE "participants" ADD COLUMN "first_name" TEXT;
ALTER TABLE "participants" ADD COLUMN "last_name" TEXT;

DROP INDEX IF EXISTS "participants_organization_id_email_key";
DROP INDEX IF EXISTS "participants_organization_id_phone_key";
DROP INDEX IF EXISTS "participants_organization_id_code_key";

CREATE UNIQUE INDEX "participants_code_key" ON "participants"("code");
CREATE INDEX "participants_organization_id_email_idx" ON "participants"("organization_id", "email");
CREATE INDEX "participants_organization_id_phone_idx" ON "participants"("organization_id", "phone");

CREATE TYPE "ContestFormStatus" AS ENUM ('draft', 'saved');
CREATE TYPE "ContestMatchRule" AS ENUM ('name_and_contact', 'contact_only');

CREATE TABLE "contest_registration_forms" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "sponsor_id" UUID,
    "contest_id" UUID,
    "status" "ContestFormStatus" NOT NULL DEFAULT 'draft',
    "opens_at" TIMESTAMPTZ(3),
    "closes_at" TIMESTAMPTZ(3),
    "seats" INTEGER,
    "welcome_message" VARCHAR(300),
    "show_contest_image" BOOLEAN NOT NULL DEFAULT true,
    "show_sponsor_name" BOOLEAN NOT NULL DEFAULT true,
    "show_registration_closes" BOOLEAN NOT NULL DEFAULT true,
    "show_seats_left" BOOLEAN NOT NULL DEFAULT true,
    "fields" JSONB NOT NULL,
    "slug" TEXT,
    "retired_slugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "link_active" BOOLEAN NOT NULL DEFAULT true,
    "email_on_quiz" BOOLEAN NOT NULL DEFAULT true,
    "domain_restriction" BOOLEAN NOT NULL DEFAULT false,
    "allowed_domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "domain_message" VARCHAR(160) NOT NULL DEFAULT 'Please use your {domains} email address to register.',
    "keep_existing_id" BOOLEAN NOT NULL DEFAULT true,
    "match_rule" "ContestMatchRule" NOT NULL DEFAULT 'name_and_contact',
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contest_registration_forms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contest_form_quizzes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contest_form_quizzes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contest_form_submissions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT,
    "answers" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contest_form_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contest_registration_forms_contest_id_key" ON "contest_registration_forms"("contest_id");
CREATE UNIQUE INDEX "contest_registration_forms_slug_key" ON "contest_registration_forms"("slug");
CREATE INDEX "contest_registration_forms_organization_id_created_at_idx" ON "contest_registration_forms"("organization_id", "created_at");
CREATE UNIQUE INDEX "contest_form_quizzes_form_id_activity_id_key" ON "contest_form_quizzes"("form_id", "activity_id");
CREATE INDEX "contest_form_quizzes_organization_id_form_id_idx" ON "contest_form_quizzes"("organization_id", "form_id");
CREATE UNIQUE INDEX "contest_form_submissions_form_id_participant_id_key" ON "contest_form_submissions"("form_id", "participant_id");
CREATE INDEX "contest_form_submissions_organization_id_form_id_idx" ON "contest_form_submissions"("organization_id", "form_id");

ALTER TABLE "contest_registration_forms" ADD CONSTRAINT "contest_registration_forms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contest_registration_forms" ADD CONSTRAINT "contest_registration_forms_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "sponsors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contest_registration_forms" ADD CONSTRAINT "contest_registration_forms_contest_id_fkey" FOREIGN KEY ("contest_id") REFERENCES "contests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contest_registration_forms" ADD CONSTRAINT "contest_registration_forms_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contest_registration_forms" ADD CONSTRAINT "contest_registration_forms_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contest_form_quizzes" ADD CONSTRAINT "contest_form_quizzes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contest_form_quizzes" ADD CONSTRAINT "contest_form_quizzes_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "contest_registration_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contest_form_quizzes" ADD CONSTRAINT "contest_form_quizzes_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contest_form_submissions" ADD CONSTRAINT "contest_form_submissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contest_form_submissions" ADD CONSTRAINT "contest_form_submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "contest_registration_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contest_form_submissions" ADD CONSTRAINT "contest_form_submissions_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
