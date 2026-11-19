import assert from 'node:assert/strict';
import type { Request } from 'express';
import { rateLimitKey } from '../src/lib/rate-limit-key.js';

/**
 * Local-only burst against the API already listening on port 3002.
 * Does not start a server and does not call production.
 */
const token = 'load-check-token';
const actorKey = rateLimitKey({
  ip: '198.51.100.10',
  headers: { authorization: `Bearer ${token}` },
} as Request);
assert.match(actorKey, /^actor:/);
assert.equal(actorKey.includes(token), false);
const ipKey = rateLimitKey({ ip: '198.51.100.10', headers: {} } as Request);
assert.match(ipKey, /^ip:/);
assert.notEqual(actorKey, ipKey);
console.log('[concurrency] rate-limit keys ok');

const healthUrl = process.env.CONCURRENCY_URL ?? 'http://127.0.0.1:3002/health';

async function probe(url: string) {
  const started = performance.now();
  const res = await fetch(url);
  return { status: res.status, ms: Math.round(performance.now() - started) };
}

let listening = true;
try {
  await fetch(healthUrl, { signal: AbortSignal.timeout(1_000) });
} catch {
  listening = false;
}

if (!listening) {
  console.log(`[concurrency] ${healthUrl} is not listening; skipped HTTP burst`);
  process.exit(0);
}

const requests = 20;
const started = performance.now();
const results = await Promise.all(Array.from({ length: requests }, () => probe(healthUrl)));
const elapsedMs = Math.round(performance.now() - started);
const times = results.map((item) => item.ms).sort((a, b) => a - b);
const percentile = (q: number) =>
  times[Math.min(times.length - 1, Math.max(0, Math.ceil((q / 100) * times.length) - 1))] ?? 0;
const statuses = [...new Set(results.map((item) => item.status))];
console.log(
  JSON.stringify({
    url: healthUrl,
    requests,
    elapsedMs,
    statuses,
    p50: percentile(50),
    p95: percentile(95),
    p99: percentile(99),
  }),
);

const readyUrl = new URL(healthUrl);
readyUrl.pathname = '/health/ready';
try {
  const ready = await probe(readyUrl.toString());
  console.log(JSON.stringify({ url: readyUrl.toString(), status: ready.status, ms: ready.ms }));
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.log(`[concurrency] ready check failed: ${message}`);
}

if (results.some((item) => item.status >= 500)) {
  process.exit(1);
}
