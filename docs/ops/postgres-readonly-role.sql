-- BrainPulses: dedicated read-only role for BI / ad-hoc reporting.
-- Does NOT change the app owner role `brainpulses` (API / Prisma / migrations).
--
-- Apply as owner (local Docker):
--   Get-Content docs/ops/postgres-readonly-role.sql | docker exec -i brainpulses-postgres psql -U brainpulses -d brainpulses
--
-- Local login (reporting only — never put this in API DATABASE_URL):
--   postgresql://brainpulses_readonly:brainpulses_ro@127.0.0.1:5434/brainpulses?schema=public

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'brainpulses_readonly') THEN
    CREATE ROLE brainpulses_readonly LOGIN PASSWORD 'brainpulses_ro'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  ELSE
    ALTER ROLE brainpulses_readonly WITH LOGIN PASSWORD 'brainpulses_ro'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;

-- Clean slate
REVOKE ALL ON DATABASE brainpulses FROM brainpulses_readonly;
REVOKE ALL ON SCHEMA public FROM brainpulses_readonly;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM brainpulses_readonly;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM brainpulses_readonly;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM brainpulses_readonly;

-- Connect + use schema (no CREATE)
GRANT CONNECT ON DATABASE brainpulses TO brainpulses_readonly;
GRANT USAGE ON SCHEMA public TO brainpulses_readonly;
REVOKE CREATE ON SCHEMA public FROM brainpulses_readonly;

-- Current objects
GRANT SELECT ON ALL TABLES IN SCHEMA public TO brainpulses_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO brainpulses_readonly;

-- Future objects created by the app owner / migration role
ALTER DEFAULT PRIVILEGES FOR ROLE brainpulses IN SCHEMA public
  GRANT SELECT ON TABLES TO brainpulses_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE brainpulses IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO brainpulses_readonly;

COMMIT;

-- ---------------------------------------------------------------------------
-- Validation (run separately as brainpulses_readonly):
--
--   docker exec -it brainpulses-postgres psql -U brainpulses_readonly -d brainpulses
--
--   SELECT COUNT(*) FROM students;          -- expect OK
--   INSERT INTO students DEFAULT VALUES;    -- expect ERROR (permission denied)
--   CREATE TABLE readonly_probe (id int);   -- expect ERROR (permission denied)
--   \q
-- ---------------------------------------------------------------------------
