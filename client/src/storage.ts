const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export function readStorage(key: string): string | null {
  try {
    return canUseStorage() ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): boolean {
  try {
    if (!canUseStorage()) return false;
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function readJson<T>(key: string, fallback: T, validate: (value: unknown) => value is T): T {
  const raw = readStorage(key);
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return validate(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function readSessionStorage(key: string): string | null {
  try { return typeof window !== 'undefined' ? window.sessionStorage.getItem(key) : null; } catch { return null; }
}

export function writeSessionStorage(key: string, value: string): boolean {
  try { if (typeof window === 'undefined') return false; window.sessionStorage.setItem(key, value); return true; } catch { return false; }
}

export function removeSessionStorage(key: string): void {
  try { if (typeof window !== 'undefined') window.sessionStorage.removeItem(key); } catch { /* Storage can be disabled by browser policy. */ }
}
