import { randomInt } from 'node:crypto';
import { conflict } from './errors.js';
import { prisma } from './prisma.js';

/** Public Registration ID: BP plus 8 digits. Shared by the live link and manual add. */
export async function nextRegistrationId() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `BP${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;
    const taken = await prisma.participant.findFirst({ where: { code }, select: { id: true } });
    if (!taken) return code;
  }
  throw conflict('Could not create a Registration ID. Try again.');
}
