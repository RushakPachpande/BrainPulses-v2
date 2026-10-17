-- Drop global unique on submit idempotency key; lookup is scoped per attempt in app code.
DROP INDEX IF EXISTS "attempts_submit_idempotency_key_key";

CREATE INDEX IF NOT EXISTS "attempts_organization_id_id_submit_idempotency_key_idx"
  ON "attempts"("organization_id", "id", "submit_idempotency_key");
