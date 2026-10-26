const UNITS: Record<string, number> = {
  b: 1,
  kb: 1024,
  mb: 1024 * 1024,
  gb: 1024 * 1024 * 1024,
};

/** Accepts `10MB`, `10 MB`, `512KB`, or a plain byte count. */
export function parseByteSize(raw: string): number | null {
  const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i.exec(raw.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = (match[2] ?? 'b').toLowerCase();
  const bytes = Math.round(amount * (UNITS[unit] ?? 0));
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  return bytes;
}
