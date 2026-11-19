import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import express, { type NextFunction, type Request, type Response } from 'express';
import { readCachedJson } from '../src/lib/cache.js';
import { lazyRouter } from '../src/lib/lazy-router.js';
import { onPoolError, sessionTimeoutMs, databaseUrlWithTimeouts } from '../src/lib/prisma.js';
import { shutdownDrainMs } from '../src/lib/process-guards.js';
import { rateLimitKey } from '../src/lib/rate-limit-key.js';
import { armRequestTimeout } from '../src/middleware/request-timeout.js';
import { sweepJobTempFiles } from '../src/lib/queue/processors.js';
import { assertQueueCapacity, attemptsForJob, rememberBounded } from '../src/lib/queue/queues.js';
import { respondExportOrAck } from '../src/lib/queue/respond-export.js';
import { AppError } from '../src/lib/errors.js';
import { readFile } from 'node:fs/promises';

describe('process stability', () => {
  test('pool error is logged and does not throw', () => {
    const lines: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    };
    try {
      const emitter = new EventEmitter();
      emitter.on('error', onPoolError);
      assert.doesNotThrow(() => {
        emitter.emit('error', new Error('connection terminated'));
      });
    } finally {
      console.error = original;
    }
    assert.match(lines.join('\n'), /connection terminated/);
  });

  test('session timeout sits under the HTTP timeout', () => {
    assert.equal(sessionTimeoutMs(30_000), 28_000);
    assert.equal(sessionTimeoutMs(1_500), 1_000);
  });

  test('session timeouts are set on the connection string before the first query', () => {
    const url = databaseUrlWithTimeouts(
      'postgresql://brainpulses:brainpulses@127.0.0.1:5434/brainpulses?schema=public',
      28_000,
    );
    const options = new URL(url).searchParams.get('options') ?? '';
    assert.match(options, /statement_timeout=28000/);
    assert.match(options, /idle_in_transaction_session_timeout=28000/);
    assert.match(url, /schema=public/);
  });

  test('production shutdown drain stays inside PM2 kill timeouts', () => {
    assert.equal(shutdownDrainMs('production', 'api'), 8_000);
    assert.equal(shutdownDrainMs('production', 'worker'), 25_000);
    assert.equal(shutdownDrainMs('development', 'api'), 1_000);
    assert.equal(shutdownDrainMs('test', 'worker'), 1_000);
  });

  test('bad cache JSON is a miss', () => {
    assert.equal(readCachedJson('{'), null);
    assert.deepEqual(readCachedJson('{"ok":true}'), { ok: true });
  });

  test('a failed route load is retried on the next request', async () => {
    let loads = 0;
    const handler = lazyRouter(async () => {
      loads += 1;
      if (loads === 1) throw new Error('transient module load');
      const router = express.Router();
      router.get('/ok', (_req, res) => {
        res.status(204).end();
      });
      return router;
    });
    const app = express();
    app.use('/api', handler);
    app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      const message = err instanceof Error ? err.message : 'error';
      res.status(500).json({ message });
    });

    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('No address');
      const base = `http://127.0.0.1:${address.port}`;
      const first = await fetch(`${base}/api/ok`);
      assert.equal(first.status, 500);
      const second = await fetch(`${base}/api/ok`);
      assert.equal(second.status, 204);
      assert.equal(loads, 2);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test('a timed-out response ignores a later write', async () => {
    const req = { requestId: 'req-1' } as Request;
    let statusCode = 200;
    let body: unknown;
    let headersSent = false;
    const res = {
      get headersSent() {
        return headersSent;
      },
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: unknown) {
        if (headersSent) return this;
        body = payload;
        headersSent = true;
        return this;
      },
      send(payload: unknown) {
        body = payload;
        headersSent = true;
        return this;
      },
      end() {
        headersSent = true;
        return this;
      },
      on() {
        return this;
      },
    } as unknown as Response;

    armRequestTimeout(req, res, 20);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(statusCode, 504);
    res.json({ error: { code: 'LATE' } });
    const payload = body as { error: { code: string; requestId: string } };
    assert.equal(payload.error.code, 'REQUEST_TIMEOUT');
    assert.equal(payload.error.requestId, 'req-1');
  });

  test('authenticated rate-limit key is not the client IP and hides the token', () => {
    const token = 'participant-token-value';
    const req = {
      ip: '203.0.113.8',
      headers: { authorization: `Bearer ${token}` },
    } as Request;
    const key = rateLimitKey(req);
    assert.match(key, /^actor:/);
    assert.equal(key.includes(token), false);
    assert.equal(key.includes('203.0.113.8'), false);

    const anon = rateLimitKey({ ip: '203.0.113.8', headers: {} } as Request);
    assert.match(anon, /^ip:/);
    assert.notEqual(anon, key);
  });
});

describe('queue bounds', () => {
  test('a full queue is a 503 and is not dropped silently', () => {
    assert.throws(
      () => assertQueueCapacity(200, 200),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.status, 503);
        assert.equal(err.code, 'SERVICE_UNAVAILABLE');
        return true;
      },
    );
    assert.doesNotThrow(() => assertQueueCapacity(199, 200));
  });

  test('SMS is sent once and other jobs keep the configured attempts', () => {
    assert.equal(attemptsForJob('sms.otp', 3), 1);
    assert.equal(attemptsForJob('report.quiz-export', 3), 3);
    assert.equal(attemptsForJob('import.participants', 3), 3);
  });

  test('inline results stay bounded', () => {
    const map = new Map<string, number>();
    rememberBounded(map, 'a', 1, 2);
    rememberBounded(map, 'b', 2, 2);
    rememberBounded(map, 'c', 3, 2);
    assert.deepEqual([...map.keys()], ['b', 'c']);
  });

  test('temp job files older than a day are removed', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'bp-jobs-'));
    const oldFile = path.join(dir, 'old.xlsx');
    const newFile = path.join(dir, 'new.xlsx');
    await writeFile(oldFile, 'old');
    await writeFile(newFile, 'new');
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await utimes(oldFile, old, old);

    const removed = await sweepJobTempFiles({ dir, now: Date.now() });
    assert.equal(removed, 1);
    await assert.rejects(() => stat(oldFile));
    const kept = await stat(newFile);
    assert.equal(kept.isFile(), true);
  });

  test('a finished export streams and a queued job returns 202', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'bp-export-'));
    const storagePath = path.join(dir, 'report.xlsx');
    await writeFile(storagePath, 'sheet');

    const streamed = mockResponse();
    await respondExportOrAck(streamed.res, {
      jobId: 'job-1',
      status: 'completed',
      result: {
        kind: 'export',
        fileName: 'report.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        storagePath,
      },
    });
    assert.equal(
      streamed.headers.get('Content-Type'),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.match(streamed.written.join(''), /sheet/);

    const queued = mockResponse();
    await respondExportOrAck(queued.res, { jobId: 'job-2', status: 'queued' });
    assert.equal(queued.statusCode, 202);
    assert.deepEqual(queued.body, { data: { jobId: 'job-2', status: 'queued' } });
  });

  test('export and import entry points do not force work onto the API process', async () => {
    const files = [
      '../src/modules/quiz-reports/controller.ts',
      '../src/modules/assessment-reports/controller.ts',
      '../src/modules/banks/import-job.ts',
      '../src/modules/participants/controller.ts',
    ];
    for (const file of files) {
      const source = await readFile(new URL(file, import.meta.url), 'utf8');
      assert.equal(source.includes('forceInline'), false, file);
    }
  });
});

function mockResponse() {
  const headers = new Map<string, string>();
  const written: string[] = [];
  let statusCode = 200;
  let body: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
    write(chunk: Buffer | string) {
      written.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return true;
    },
    end(chunk?: Buffer | string) {
      if (chunk) written.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return this;
    },
    on() {
      return this;
    },
    once() {
      return this;
    },
    emit() {
      return false;
    },
  } as unknown as Response;
  return {
    res,
    headers,
    written,
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
  };
}
