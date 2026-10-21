-- CreateEnum
CREATE TYPE "BankOrigin" AS ENUM ('reusable', 'round_local');

-- AlterTable
ALTER TABLE "question_banks" ADD COLUMN "origin" "BankOrigin" NOT NULL DEFAULT 'reusable';

-- CreateIndex
CREATE INDEX "question_banks_organization_id_origin_idx" ON "question_banks"("organization_id", "origin");

-- CreateTable
CREATE TABLE "activity_rounds" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "duration_minutes" INTEGER,
    "local_bank_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "activity_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_round_banks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "round_id" UUID NOT NULL,
    "bank_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_round_banks_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "attempts" ADD COLUMN "round_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "activity_rounds_local_bank_id_key" ON "activity_rounds"("local_bank_id");

-- CreateIndex
CREATE INDEX "activity_rounds_organization_id_activity_id_idx" ON "activity_rounds"("organization_id", "activity_id");

-- CreateIndex
CREATE UNIQUE INDEX "activity_rounds_activity_id_sort_order_key" ON "activity_rounds"("activity_id", "sort_order");

-- CreateIndex
CREATE INDEX "activity_round_banks_organization_id_round_id_idx" ON "activity_round_banks"("organization_id", "round_id");

-- CreateIndex
CREATE UNIQUE INDEX "activity_round_banks_round_id_bank_id_key" ON "activity_round_banks"("round_id", "bank_id");

-- CreateIndex
CREATE INDEX "attempts_organization_id_activity_id_round_id_student_id_status_idx" ON "attempts"("organization_id", "activity_id", "round_id", "student_id", "status");

-- AddForeignKey
ALTER TABLE "activity_rounds" ADD CONSTRAINT "activity_rounds_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_rounds" ADD CONSTRAINT "activity_rounds_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_rounds" ADD CONSTRAINT "activity_rounds_local_bank_id_fkey" FOREIGN KEY ("local_bank_id") REFERENCES "question_banks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_round_banks" ADD CONSTRAINT "activity_round_banks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_round_banks" ADD CONSTRAINT "activity_round_banks_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "activity_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_round_banks" ADD CONSTRAINT "activity_round_banks_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "question_banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "activity_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data migration: assessment ActivityBanks → Round 1
INSERT INTO "activity_rounds" ("id", "organization_id", "activity_id", "name", "sort_order", "created_at", "updated_at")
SELECT gen_random_uuid(), a."organization_id", a."id", 'Round 1', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "activities" a
WHERE a."kind" = 'assessment'
  AND NOT EXISTS (
    SELECT 1 FROM "activity_rounds" r WHERE r."activity_id" = a."id"
  );

INSERT INTO "activity_round_banks" ("id", "organization_id", "round_id", "bank_id", "created_at")
SELECT gen_random_uuid(), ab."organization_id", r."id", ab."bank_id", CURRENT_TIMESTAMP
FROM "activity_banks" ab
INNER JOIN "activities" a ON a."id" = ab."activity_id" AND a."kind" = 'assessment'
INNER JOIN "activity_rounds" r ON r."activity_id" = a."id" AND r."sort_order" = 0
ON CONFLICT ("round_id", "bank_id") DO NOTHING;
