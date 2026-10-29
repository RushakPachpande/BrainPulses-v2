-- AlterTable
ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "settings" JSONB;
