-- Unique phone per organization (NULLs remain allowed / non-conflicting in Postgres).
CREATE UNIQUE INDEX "students_organization_id_phone_key" ON "students"("organization_id", "phone");
