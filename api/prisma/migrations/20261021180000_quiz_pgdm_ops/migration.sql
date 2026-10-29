-- CreateEnum
CREATE TYPE "ReattemptMode" AS ENUM ('continue', 'restart');

-- AlterTable
ALTER TABLE "students" ADD COLUMN "cohort" TEXT;

-- CreateIndex
CREATE INDEX "students_organization_id_cohort_idx" ON "students"("organization_id", "cohort");

-- AlterTable
ALTER TABLE "attempts" ADD COLUMN "question_order" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "attempts" ADD COLUMN "option_orders" JSONB;
ALTER TABLE "attempts" ADD COLUMN "is_authoritative" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "attempts" ADD COLUMN "disqualified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "attempts" ADD COLUMN "disqualified_at" TIMESTAMPTZ(3);
ALTER TABLE "attempts" ADD COLUMN "disqualified_by_user_id" UUID;
ALTER TABLE "attempts" ADD COLUMN "disqualified_note" TEXT;

-- CreateIndex
CREATE INDEX "attempts_organization_id_activity_id_is_authoritative_disqualified_idx" ON "attempts"("organization_id", "activity_id", "is_authoritative", "disqualified");

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_disqualified_by_user_id_fkey" FOREIGN KEY ("disqualified_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "reattempt_grants" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "mode" "ReattemptMode" NOT NULL,
    "note" TEXT,
    "granted_by_user_id" UUID NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reattempt_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reattempt_grants_organization_id_activity_id_student_id_consumed_at_idx" ON "reattempt_grants"("organization_id", "activity_id", "student_id", "consumed_at");

-- AddForeignKey
ALTER TABLE "reattempt_grants" ADD CONSTRAINT "reattempt_grants_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reattempt_grants" ADD CONSTRAINT "reattempt_grants_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reattempt_grants" ADD CONSTRAINT "reattempt_grants_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reattempt_grants" ADD CONSTRAINT "reattempt_grants_granted_by_user_id_fkey" FOREIGN KEY ("granted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
