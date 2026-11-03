-- AlterTable
ALTER TABLE "activity_rounds" ADD COLUMN "image_file_id" UUID;

-- CreateIndex
CREATE INDEX "activity_rounds_organization_id_image_file_id_idx" ON "activity_rounds"("organization_id", "image_file_id");

-- AddForeignKey
ALTER TABLE "activity_rounds" ADD CONSTRAINT "activity_rounds_image_file_id_fkey" FOREIGN KEY ("image_file_id") REFERENCES "file_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
