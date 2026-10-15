import { readSessionStorage, removeSessionStorage, writeSessionStorage } from '../storage';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
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
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    if (body.error) {
      return new ApiError(
        res.status,
        body.error.code ?? 'UNKNOWN',
        body.error.message ?? (res.statusText || 'Request failed.'),
      );
    }
  } catch {
    /* ignore */
  }
  return new ApiError(res.status, 'UNKNOWN', res.statusText || 'Request failed.');
}

async function request(
  path: string,
  init: RequestInit = {},
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) headers.set(k, v);
  }
  return fetch(`${apiBaseUrl()}${path}`, { ...init, headers });
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
