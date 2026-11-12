import { z } from 'zod';

const SKIP = new Set(['any', 'all', 'Any', 'All']);

/** Repeated query keys or a comma list. Empty, any, and all mean no filter. */
export function queryList(value: unknown): string[] {
  if (value == null) return [];
  const raw = Array.isArray(value) ? value : [value];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    for (const part of String(item).split(',')) {
      const text = part.trim();
      if (!text || SKIP.has(text) || seen.has(text)) continue;
      seen.add(text);
      out.push(text);
    }
  }
  return out;
}

export function uuidListSchema() {
  return z.preprocess(queryList, z.array(z.string().uuid()).max(50));
}

export function enumListSchema<const T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess(queryList, z.array(z.enum(values)).max(20));
}
