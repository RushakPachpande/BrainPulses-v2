-- CreateEnum
CREATE TYPE "ContestThankYouKind" AS ENUM ('template', 'custom', 'image');

-- AlterTable
ALTER TABLE "contest_registration_forms"
ADD COLUMN "thank_you_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "thank_you_kind" "ContestThankYouKind" NOT NULL DEFAULT 'template',
ADD COLUMN "thank_you_title" VARCHAR(120),
ADD COLUMN "thank_you_html" TEXT,
ADD COLUMN "thank_you_image_file_id" UUID,
ADD COLUMN "thank_you_show_next_steps" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "thank_you_show_quizzes" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "thank_you_button_label" VARCHAR(80),
ADD COLUMN "thank_you_button_url" VARCHAR(500);

-- CreateIndex
CREATE INDEX "contest_registration_forms_organization_id_thank_you_image_file_id_idx" ON "contest_registration_forms"("organization_id", "thank_you_image_file_id");

-- AddForeignKey
ALTER TABLE "contest_registration_forms" ADD CONSTRAINT "contest_registration_forms_thank_you_image_file_id_fkey" FOREIGN KEY ("thank_you_image_file_id") REFERENCES "file_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
