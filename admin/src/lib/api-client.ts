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

/** Merge caller signal with a 30s timeout. `timedOut` is true when our timer fired. */
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

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

export type RefreshedSession = {
  accessToken: string;
  user: { id: string; email: string; name: string };
  organization: { id: string; name: string; slug: string };
  membership: {
    id: string;
    role: string;
    assessmentAccess: string;
    quizAccess: string;
  };
};

let sessionRefreshInflight: Promise<RefreshedSession | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

/**
 * In DEV, call the Vite proxy (same origin) so the httpOnly refresh cookie is
 * first-party. Absolute VITE_API_URL to 127.0.0.1 from a localhost page is
 * cross-site and browsers will not send SameSite=Lax cookies on fetch POST.
 */
function apiBaseUrl(): string {
  if (import.meta.env.DEV) {
    return '';
  }
  const raw = import.meta.env.VITE_API_URL;
  if (!raw) {
    throw new Error('VITE_API_URL is not configured.');
  }
  return raw.replace(/\/$/, '');
}

/** Single-flight refresh so React Strict Mode double-mount cannot reuse a rotated token. */
export async function refreshAuthSession(): Promise<RefreshedSession | null> {
  if (!sessionRefreshInflight) {
    sessionRefreshInflight = (async () => {
      trackLoading(1);
      const { signal, timedOut } = withRequestTimeout();
      try {
        const res = await fetch(`${apiBaseUrl()}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          signal,
        });
        if (res.status === 204) return null;
        if (!res.ok) return null;
        const body = (await res.json()) as { data?: RefreshedSession };
        const data = body.data;
        if (!data?.accessToken) return null;
        setAccessToken(data.accessToken);
        return data;
      } catch (err) {
        if (isAbortError(err) && timedOut()) return null;
        return null;
      } finally {
        trackLoading(-1);
      }
    })().finally(() => {
      sessionRefreshInflight = null;
    });
  }
  return sessionRefreshInflight;
}

async function parseApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as {
      error?: { code?: string; message?: string; fields?: Record<string, string> };
    };
    const err = body.error;
    if (err) {
      const fieldHint =
        err.fields && Object.keys(err.fields).length > 0
          ? ` ${Object.entries(err.fields)
              .map(([k, v]) => (k === '_' ? v : `${k}: ${v}`))
              .join(' ')}`
          : '';
      return new ApiError(
        res.status,
        err.code ?? 'UNKNOWN',
        `${err.message ?? (res.statusText || 'Request failed.')}${fieldHint}`.trim(),
      );
    }
  } catch {
    /* ignore */
  }
  return new ApiError(res.status, 'UNKNOWN', res.statusText || 'Request failed.');
}

async function refreshSessionOnce(): Promise<boolean> {
  const session = await refreshAuthSession();
  return session != null;
}

async function request(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  if (!retried) trackLoading(1);
  try {
    const headers = new Headers(init.headers);
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
    if (init.body != null && !headers.has('Content-Type') && !isFormData) {
      headers.set('Content-Type', 'application/json');
    }

    const { signal, timedOut } = withRequestTimeout(init.signal);
    let res: Response;
    try {
      res = await fetch(`${apiBaseUrl()}${path}`, {
        ...init,
        headers,
        credentials: 'include',
        signal,
      });
    } catch (err) {
      if (isAbortError(err) && timedOut()) throw timeoutError();
      throw err;
    }

    if (res.status === 401 && !retried && !path.startsWith('/api/auth/')) {
      if (!refreshPromise) {
        refreshPromise = refreshSessionOnce().finally(() => {
          refreshPromise = null;
        });
      }
      const refreshed = await refreshPromise;
      if (refreshed) return request(path, init, true);
    }

    if (!res.ok) throw await parseApiError(res);
    return res;
  } finally {
    if (!retried) trackLoading(-1);
  }
}

export async function apiRequest<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await request(path, init);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function apiGetData<T>(path: string): Promise<T> {
  const body = await apiRequest<{ data: T }>(path);
  return body.data;
}

export type ListEnvelope<T> = {
  data: T[];
  page: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
    total: number;
  };
};

export async function apiGetList<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T[]> {
  const qs = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') qs.set(key, String(value));
    }
  }
  const query = qs.toString();
  const body = await apiRequest<ListEnvelope<T>>(`${path}${query ? `?${query}` : ''}`);
  return body.data;
}

export async function apiPostData<T>(path: string, payload?: unknown): Promise<T> {
  const body = await apiRequest<{ data: T }>(path, {
    method: 'POST',
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });
  return body.data;
}

export async function apiPatchData<T>(path: string, payload: unknown): Promise<T> {
  const body = await apiRequest<{ data: T }>(path, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return body.data;
}

export async function apiPostFormData<T>(path: string, formData: FormData): Promise<T> {
  const body = await apiRequest<{ data: T }>(path, {
    method: 'POST',
    body: formData,
  });
  return body.data;
}

function filenameFromContentDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf?.[1]) {
    try {
      return decodeURIComponent(utf[1].trim());
    } catch {
      return utf[1].trim();
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() || fallback;
}

/** Download a binary/text attachment and trigger a browser save. */
export async function apiDownloadBlob(path: string, fallbackFilename: string): Promise<void> {
  const res = await request(path);
  const blob = await res.blob();
  const filename = filenameFromContentDisposition(
    res.headers.get('Content-Disposition'),
    fallbackFilename,
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
