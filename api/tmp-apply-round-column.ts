import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import './src/config/load-env.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 8000,
});
const sql = readFileSync(
  'prisma/migrations/20261107120000_round_results_published/migration.sql',
);
const checksum = createHash('sha256').update(sql).digest('hex');
const client = await pool.connect();
try {
  await client.query(
    'ALTER TABLE "activity_rounds" ADD COLUMN IF NOT EXISTS "results_published_at" TIMESTAMPTZ(3)',
  );
  const name = '20261107120000_round_results_published';
  const existing = await client.query(
    'SELECT 1 FROM "_prisma_migrations" WHERE migration_name = $1',
    [name],
  );
  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO "_prisma_migrations"
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES (gen_random_uuid()::text, $1, NOW(), $2, NULL, NULL, NOW(), 1)`,
      [checksum, name],
    );
  }
  console.log('round results column ready');
} finally {
  client.release();
  await pool.end();
}
