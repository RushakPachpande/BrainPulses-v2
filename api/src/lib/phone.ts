import { parsePhoneNumberFromString } from 'libphonenumber-js';

const DEFAULT_REGION = 'IN' as const;

/** Normalize to E.164. National numbers without '+' use DEFAULT_REGION (IN). */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parsed = parsePhoneNumberFromString(
    trimmed,
    trimmed.startsWith('+') ? undefined : DEFAULT_REGION,
  );
  if (parsed?.isValid()) return parsed.format('E.164');

  // Fallback for stored spaced formats that libphonenumber rejects.
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  if (hasPlus) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

export function toE164(countryCode: string, mobileNumber: string): string | null {
  const cc = countryCode.trim();
  const national = mobileNumber.trim().replace(/\D/g, '');
  if (!national) return null;
  const combined = `${cc.startsWith('+') ? cc : `+${cc.replace(/\D/g, '')}`}${national}`;
  return normalizePhone(combined);
}
