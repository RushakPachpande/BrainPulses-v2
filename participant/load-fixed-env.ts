import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

/**
 * Same rule as api/src/config/load-env.ts.
 * Dev → `.env.dev` then `.env`. Prod → `.env.prod` then `.env`.
 * Never `.env.production`, `.env.local`, `.env.[mode]`, or any other name.
 */
export function loadFixedEnv(root: string, mode: string): Record<string, string> {
  const isProd = mode === 'production' || mode === 'singlefile';
  const candidates = isProd ? ['.env.prod', '.env'] : ['.env.dev', '.env'];

  for (const name of candidates) {
    const fullPath = resolve(root, name);
    if (!existsSync(fullPath)) continue;
    const parsed: Record<string, string> = {};
    for (const [key, value] of Object.entries(parseEnv(readFileSync(fullPath, 'utf8')))) {
      if (value === undefined) continue;
      parsed[key] = value;
      if (process.env[key] === undefined) process.env[key] = value;
    }
    return parsed;
  }

  return {};
}
