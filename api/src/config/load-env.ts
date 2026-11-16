import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

/** Absolute path to the `api/` package root. */
export const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Load env from exactly one allowed file (first match wins):
 *
 * - production → `.env.prod`, then `.env`
 * - anything else → `.env.dev`, then `.env`
 *
 * No other names (`.env.production`, `.env.local`, `.env.p`, …) are read.
 * NODE_ENV is taken from the process (shell / nodemon / PM2), not from guessing filenames.
 */
export function resolveEnvPath(): string | undefined {
  const isProduction = process.env.NODE_ENV === 'production';
  const candidates = isProduction ? ['.env.prod', '.env'] : ['.env.dev', '.env'];

  for (const name of candidates) {
    const fullPath = resolve(apiRoot, name);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  return undefined;
}

const envPath = resolveEnvPath();
if (envPath) {
  config({ path: envPath });
}
