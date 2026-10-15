/**
 * Allowlisted CORS origins from CORS_ORIGIN, plus (outside production)
 * localhost and RFC1918 LAN origins so phones/laptops on the same network
 * can hit the API when not going through the Vite proxy.
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

export function createCorsOriginDelegate(
  allowlistRaw: string,
  nodeEnv: string,
): (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void {
  const allowlist = allowlistRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowlist.includes(origin)) {
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
