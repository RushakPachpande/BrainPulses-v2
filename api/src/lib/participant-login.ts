import { prisma } from './prisma.js';

export const PARTICIPANT_PHONE_LOGIN_KEY = 'participantPhoneLogin';

export async function isParticipantPhoneLoginEnabled(organizationId: string): Promise<boolean> {
  const row = await prisma.setting.findUnique({
    where: {
      organizationId_group_key: {
        organizationId,
        group: 'general',
        key: PARTICIPANT_PHONE_LOGIN_KEY,
      },
    },
  });
  if (row && typeof row.value === 'boolean') return row.value;
  return true;
}

/**
 * Unauthenticated login chrome.
 * With a slug: that org’s setting. Without: the oldest active org (primary tenant).
 * OTP is always blocked for an org that has phone login turned off.
 */
export async function getParticipantLoginOptions(organizationSlug?: string) {
  const org = organizationSlug
    ? await prisma.organization.findFirst({
        where: { slug: organizationSlug, isActive: true },
        select: { id: true },
      })
    : await prisma.organization.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });

  if (!org) return { phoneLogin: true };
  return { phoneLogin: await isParticipantPhoneLoginEnabled(org.id) };
}
