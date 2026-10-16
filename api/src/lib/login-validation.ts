import { isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js';
import { KNOWN_DIAL_CODES } from './country-dial-codes.js';

/** Unique ID: 4–40 chars, letters/digits/hyphen/underscore (rejects short values like "BP"). */
export const UNIQUE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{3,39}$/;

export function isValidUniqueId(code: string): boolean {
  return UNIQUE_ID_RE.test(code.trim());
}

/** Normalize dial to `+` + digits. */
export function normalizeDialCode(countryCode: string): string {
  const digits = countryCode.trim().replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

export function isKnownDialCode(countryCode: string): boolean {
  const dial = normalizeDialCode(countryCode);
  if (!dial) return false;
  return KNOWN_DIAL_CODES.has(dial);
}

/**
 * Country-aware national mobile validation (mirrors client login rules).
 * India (+91): exactly 10 digits starting with 6–9.
 */
export function isValidNationalMobile(countryCode: string, mobileNumber: string): boolean {
  const dial = normalizeDialCode(countryCode);
  const national = mobileNumber.replace(/\D/g, '');
  if (!dial || !national || !isKnownDialCode(dial)) return false;

  if (dial === '+91') {
    return /^[6-9]\d{9}$/.test(national);
  }

  const e164 = `${dial}${national}`;
  if (!isValidPhoneNumber(e164)) return false;

  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed?.isValid()) return false;

  const type = parsed.getType();
  if (type == null) return true;
  return type === 'MOBILE' || type === 'FIXED_LINE_OR_MOBILE';
}
