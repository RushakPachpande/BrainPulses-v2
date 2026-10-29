import { describe, expect, it } from 'vitest';
import { isValidNationalMobile, isValidUniqueId } from './login-validation';

describe('isValidUniqueId', () => {
  it('accepts a normal student code', () => {
    expect(isValidUniqueId('BP-24101')).toBe(true);
  });

  it('trims surrounding spaces', () => {
    expect(isValidUniqueId('  BP-24101  ')).toBe(true);
  });

  it('rejects codes shorter than 4 characters', () => {
    expect(isValidUniqueId('BP')).toBe(false);
    expect(isValidUniqueId('')).toBe(false);
  });

  it('rejects a leading hyphen and a 41-character code', () => {
    expect(isValidUniqueId('-BP24101')).toBe(false);
    expect(isValidUniqueId(`A${'b'.repeat(40)}`)).toBe(false);
  });
});

describe('isValidNationalMobile', () => {
  it('accepts a 10-digit Indian mobile starting with 6-9', () => {
    expect(isValidNationalMobile('+91', '9876510000')).toBe(true);
  });

  it('rejects an Indian mobile that is too short or starts with 5', () => {
    expect(isValidNationalMobile('+91', '987651000')).toBe(false);
    expect(isValidNationalMobile('+91', '5876510000')).toBe(false);
  });
});
