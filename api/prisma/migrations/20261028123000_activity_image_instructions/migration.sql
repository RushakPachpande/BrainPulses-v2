-- AlterTable
ALTER TABLE "activities" ADD COLUMN "instructions" TEXT,
ADD COLUMN "image_file_id" UUID;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_image_file_id_fkey" FOREIGN KEY ("image_file_id") REFERENCES "file_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "activities_organization_id_image_file_id_idx" ON "activities"("organization_id", "image_file_id");
