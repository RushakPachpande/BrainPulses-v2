const LEGACY_LOCAL_KEYS = [
  'brainpulses-client-theme',
  'bp-client-name',
  'bp-client-email',
  'bp-client-attempts',
] as const;

/** Remove durable localStorage left by older builds / handoff prototype. */
export function purgeDurableClientPrefs() {
  try {
    for (const key of LEGACY_LOCAL_KEYS) window.localStorage.removeItem(key);
  } catch {
    /* Storage can be disabled by browser policy. */
  }
}

export function readSessionStorage(key: string): string | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

export function writeSessionStorage(key: string, value: string): boolean {
  try {
    if (typeof window === 'undefined') return false;
    window.sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeSessionStorage(key: string): void {
  try {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(key);
  } catch {
    /* Storage can be disabled by browser policy. */
  }
}

/** Session-scoped only — survives refresh, not clear-site-data / tab close. */
export function readStorage(key: string): string | null {
  return readSessionStorage(key);
}

export function writeStorage(key: string, value: string): boolean {
  return writeSessionStorage(key, value);
}

export function readJson<T>(key: string, fallback: T, validate: (value: unknown) => value is T): T {
  const raw = readSessionStorage(key);
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return validate(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}
