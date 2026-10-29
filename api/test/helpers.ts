import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { initRedis } from '../src/lib/redis.js';

let app: Express | null = null;

export async function getTestApp(): Promise<Express> {
  if (!app) {
    await initRedis();
    app = createApp();
  }
  return app;
}

export async function request(
  appInstance: Express,
  method: string,
  path: string,
  options: {
    body?: unknown;
    headers?: Record<string, string>;
    cookies?: string;
  } = {},
): Promise<{ status: number; body: unknown; headers: Headers; setCookie: string[] }> {
  const headers = new Headers(options.headers ?? {});
  if (options.body !== undefined) {
    headers.set('content-type', 'application/json');
  }
  if (options.cookies) {
    headers.set('cookie', options.cookies);
  }

  const server = appInstance.listen(0);
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', () => resolve());
      server.once('error', reject);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No address');
    const res = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    const setCookie = res.headers.getSetCookie?.() ?? [];
    return { status: res.status, body, headers: res.headers, setCookie };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

export function cookieHeader(setCookie: string[]): string {
  return setCookie.map((c) => c.split(';')[0]).join('; ');
}
