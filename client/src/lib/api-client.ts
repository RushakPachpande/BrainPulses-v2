import { readSessionStorage, removeSessionStorage, writeSessionStorage } from '../storage';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const REQUEST_TIMEOUT_MS = 30_000;

type ApiLoadingListener = (delta: 1 | -1) => void;

let loadingListener: ApiLoadingListener | null = null;

/** Wired by ApiLoadingProvider so in-flight fetches drive the blocking overlay. */
export function setApiLoadingListener(listener: ApiLoadingListener | null) {
  loadingListener = listener;
}

function trackLoading(delta: 1 | -1) {
  loadingListener?.(delta);
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

function timeoutError() {
  return new ApiError(408, 'TIMEOUT', 'Request timed out. Please try again.');
}

function withRequestTimeout(userSignal?: AbortSignal | null): {
  signal: AbortSignal;
  timedOut: () => boolean;
} {
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let timedOut = false;
  timeoutSignal.addEventListener(
    'abort',
    () => {
      timedOut = true;
    },
    { once: true },
  );

  if (!userSignal) {
    return { signal: timeoutSignal, timedOut: () => timedOut };
  }

  if (typeof AbortSignal.any === 'function') {
    return {
      signal: AbortSignal.any([userSignal, timeoutSignal]),
      timedOut: () => timedOut,
    };
  }

  const ctrl = new AbortController();
  const abortFrom = (source: AbortSignal) => {
    if (ctrl.signal.aborted) return;
    if (source === timeoutSignal) timedOut = true;
    ctrl.abort(source.reason);
  };
  if (userSignal.aborted) abortFrom(userSignal);
  else userSignal.addEventListener('abort', () => abortFrom(userSignal), { once: true });
  if (timeoutSignal.aborted) abortFrom(timeoutSignal);
  else timeoutSignal.addEventListener('abort', () => abortFrom(timeoutSignal), { once: true });
  return { signal: ctrl.signal, timedOut: () => timedOut };
}

const TOKEN_KEY = 'bp-client-access-token';

let accessToken: string | null = readSessionStorage(TOKEN_KEY);

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) writeSessionStorage(TOKEN_KEY, token);
  else removeSessionStorage(TOKEN_KEY);
}

export function getAccessToken() {
  return accessToken;
}

function apiBaseUrl(): string {
  if (import.meta.env.DEV) return '';
  const raw = import.meta.env.VITE_API_URL;
  if (!raw) throw new Error('VITE_API_URL is not configured.');
  return raw.replace(/\/$/, '');
}

async function parseApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as {
      error?: { code?: string; message?: string; fields?: Record<string, string> };
    };
    if (body.error) {
      return new ApiError(
        res.status,
        body.error.code ?? 'UNKNOWN',
        body.error.message ?? (res.statusText || 'Request failed.'),
        body.error.fields,
      );
    }
  } catch {
    /* ignore */
  }
  return new ApiError(res.status, 'UNKNOWN', res.statusText || 'Request failed.');
}

export function isSessionActiveConflict(err: unknown): boolean {
  return err instanceof ApiError && err.status === 409 && err.fields?.reason === 'SESSION_ACTIVE';
}

async function request(
  path: string,
  init: RequestInit = {},
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  trackLoading(1);
  try {
    const headers = new Headers(init.headers);
    if (init.body !== undefined && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
    if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders)) headers.set(k, v);
    }

    const { signal, timedOut } = withRequestTimeout(init.signal);
    try {
      return await fetch(`${apiBaseUrl()}${path}`, { ...init, headers, signal });
    } catch (err) {
      if (isAbortError(err) && timedOut()) throw timeoutError();
      throw err;
    }
  } finally {
    trackLoading(-1);
  }
}

export async function apiGetData<T>(path: string): Promise<T> {
  const res = await request(path);
  if (!res.ok) throw await parseApiError(res);
  const body = (await res.json()) as { data: T };
  return body.data;
}

export async function apiGetList<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T[]> {
  const url = new URL(path, 'http://local.invalid');
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  const res = await request(`${url.pathname}${url.search}`);
  if (!res.ok) throw await parseApiError(res);
  const body = (await res.json()) as { data: T[] };
  return body.data;
}

export async function apiPostData<T>(
  path: string,
  payload?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const res = await request(
    path,
    {
      method: 'POST',
      body: payload === undefined ? undefined : JSON.stringify(payload),
    },
    extraHeaders,
  );
  if (!res.ok) throw await parseApiError(res);
  const body = (await res.json()) as { data: T };
  return body.data;
}

export async function apiPatchData<T>(path: string, payload: unknown): Promise<T> {
  const res = await request(path, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await parseApiError(res);
  const body = (await res.json()) as { data: T };
  return body.data;
}
