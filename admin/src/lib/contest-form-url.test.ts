import { describe, expect, it } from 'vitest';
import { participantOriginFromAdminHost } from './contest-form';

describe('registration link host fallback', () => {
  it('maps admin.brainpulses.com to participant.brainpulses.com', () => {
    expect(participantOriginFromAdminHost('admin.brainpulses.com', 'https:')).toBe(
      'https://participant.brainpulses.com',
    );
  });

  it('leaves non-admin hosts alone', () => {
    expect(participantOriginFromAdminHost('localhost', 'http:')).toBeNull();
    expect(participantOriginFromAdminHost('participant.brainpulses.com', 'https:')).toBeNull();
  });
});
