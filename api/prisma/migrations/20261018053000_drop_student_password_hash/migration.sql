-- Student auth is Unique ID + phone OTP only; drop unused password column.
ALTER TABLE "students" DROP COLUMN IF EXISTS "password_hash";
