/** Normalize to E.164-ish: leading +, digits only after. Returns null if empty. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  return hasPlus || digits.length > 10 ? `+${digits}` : `+${digits}`;
}

export function toE164(countryCode: string, mobileNumber: string): string | null {
  const cc = countryCode.trim().replace(/[^\d+]/g, '');
  const national = mobileNumber.trim().replace(/\D/g, '');
  if (!national) return null;
  const ccDigits = cc.replace(/\D/g, '');
  if (!ccDigits) return normalizePhone(national);
  return `+${ccDigits}${national}`;
}
