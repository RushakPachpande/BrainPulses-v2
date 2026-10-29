import { z } from 'zod';
import { unauthorized } from './errors.js';
import { verifyPassword } from './password.js';
import { prisma } from './prisma.js';

/** Body schema for destructive DELETE actions that re-auth the signed-in admin. */
export const confirmPasswordSchema = z.object({
  password: z.string().min(1, 'Password is required.'),
});

/** Verifies the acting admin’s password before a destructive mutation. */
export async function verifyActingUserPassword(userId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw unauthorized('Confirm your password to continue. Sign in again if needed.');
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw unauthorized('Password is incorrect.');
}
