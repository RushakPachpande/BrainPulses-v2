/**
 * Session-scoped UI prefs only. Nothing here should survive "Clear site data"
 * or closing the tab — durable auth stays on HttpOnly cookies from the API.
 */

const LEGACY_LOCAL_KEYS = ['brainpulses-theme', 'brainpulses-client-theme'] as const;

const LEGACY_KEY_PREFIXES = ['bp-quiz-report-columns:', 'bp-assessment-report-columns:'] as const;

const SIDEBAR_COOKIE_NAME = 'sidebar_state';

function removeLocalKey(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* Storage can be disabled by browser policy. */
  }
}

/** Drop durable browser prefs left by older builds (localStorage + sidebar cookie). */
export function purgeDurableBrowserPrefs() {
  for (const key of LEGACY_LOCAL_KEYS) removeLocalKey(key);

  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        LEGACY_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)) ||
        key.startsWith('bp-quiz-report-columns:') ||
        key.includes('report-columns')
      ) {
        doomed.push(key);
      }
    }
    for (const key of doomed) localStorage.removeItem(key);
  } catch {
    /* ignore */
  }

  try {
    document.cookie = `${SIDEBAR_COOKIE_NAME}=; path=/; max-age=0`;
  } catch {
    /* ignore */
  }
}

export function readSessionPref(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSessionPref(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function removeSessionPref(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
