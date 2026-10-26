-- CreateEnum
CREATE TYPE "DurationMode" AS ENUM ('overall', 'per_question');

-- CreateTable
CREATE TABLE "sponsors" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "image_file_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "sponsor_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_file_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contests_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "activities" ADD COLUMN "duration_mode" "DurationMode" NOT NULL DEFAULT 'overall',
ADD COLUMN "per_question_seconds" INTEGER,
ADD COLUMN "sponsor_id" UUID,
ADD COLUMN "contest_id" UUID;

-- CreateIndex
CREATE INDEX "sponsors_organization_id_name_idx" ON "sponsors"("organization_id", "name");

-- CreateIndex
CREATE INDEX "contests_organization_id_sponsor_id_idx" ON "contests"("organization_id", "sponsor_id");

-- CreateIndex
CREATE INDEX "contests_organization_id_name_idx" ON "contests"("organization_id", "name");

-- CreateIndex
CREATE INDEX "activities_organization_id_sponsor_id_idx" ON "activities"("organization_id", "sponsor_id");

-- CreateIndex
CREATE INDEX "activities_organization_id_contest_id_idx" ON "activities"("organization_id", "contest_id");

-- AddForeignKey
ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_image_file_id_fkey" FOREIGN KEY ("image_file_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contests" ADD CONSTRAINT "contests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contests" ADD CONSTRAINT "contests_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "sponsors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contests" ADD CONSTRAINT "contests_image_file_id_fkey" FOREIGN KEY ("image_file_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "sponsors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_contest_id_fkey" FOREIGN KEY ("contest_id") REFERENCES "contests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
