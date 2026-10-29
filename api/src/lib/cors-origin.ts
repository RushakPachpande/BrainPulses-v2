/**
 * Allowlisted CORS origins from CORS_ORIGIN, plus (outside production)
 * localhost and RFC1918 LAN origins so phones/laptops on the same network
 * can hit the API when not going through the Vite proxy.
 *
 * An allowlist entry may use `*` for a host label you choose, for example
 * `https://*.trycloudflare.com`. A bare `*` allows every http(s) origin.
 * Wildcards are rejected in production; list exact origins there.
 */
export function isPrivateNetworkOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return true;
    if (/^10(?:\.\d{1,3}){3}$/.test(host)) return true;
    if (/^192\.168(?:\.\d{1,3}){2}$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

/** `*` matches one or more characters except `/`, so a host wildcard stays on that host pattern. */
function originMatchesEntry(origin: string, entry: string): boolean {
  if (entry === '*') {
    try {
      const url = new URL(origin);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }
  if (!entry.includes('*')) return entry === origin;
  const pattern = entry.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '[^/]+');
  return new RegExp(`^${pattern}$`).test(origin);
}

export function createCorsOriginDelegate(
  allowlistRaw: string,
  nodeEnv: string,
): (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void {
  const allowlist = allowlistRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (nodeEnv === 'production' && allowlist.some((entry) => entry.includes('*'))) {
    throw new Error(
      'CORS_ORIGIN wildcards are only allowed outside production. List exact https origins.',
    );
  }

  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowlist.some((entry) => originMatchesEntry(origin, entry))) {
      callback(null, true);
      return;
    }
    if (nodeEnv !== 'production' && isPrivateNetworkOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  };
}
