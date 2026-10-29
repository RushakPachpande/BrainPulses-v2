import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

/** Absolute path to the `api/` package root. */
export const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Load environment variables from a mode-specific file.
 *
 * - development / test / unset → prefer `.env.dev`, then `.env`
 * - production → prefer `.env.prod`, then `.env`
 *
 * NODE_ENV often lives inside the file, so we key off the process value that
 * was already set by the shell, nodemon, or the process manager.
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
