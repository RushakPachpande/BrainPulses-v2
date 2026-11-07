import { notFound } from './errors.js';
import { readInlineImage } from '../modules/files/service.js';
import { prisma } from './prisma.js';

export const PARTICIPANT_PHONE_LOGIN_KEY = 'participantPhoneLogin';
export const PARTICIPANT_LOGIN_IMAGE_KEY = 'participantLoginImageFileId';

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
async function resolveLoginOrganization(organizationSlug?: string) {
  return organizationSlug
    ? prisma.organization.findFirst({
        where: { slug: organizationSlug, isActive: true },
        select: { id: true },
      })
    : prisma.organization.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
}

async function participantLoginImageFileId(organizationId: string) {
  const row = await prisma.setting.findUnique({
    where: {
      organizationId_group_key: {
        organizationId,
        group: 'general',
        key: PARTICIPANT_LOGIN_IMAGE_KEY,
      },
    },
  });
  return typeof row?.value === 'string' ? row.value.trim() : '';
}

export async function getParticipantLoginOptions(organizationSlug?: string) {
  const org = await resolveLoginOrganization(organizationSlug);
  if (!org) return { phoneLogin: true, loginImage: false };
  const [phoneLogin, loginImageFileId] = await Promise.all([
    isParticipantPhoneLoginEnabled(org.id),
    participantLoginImageFileId(org.id),
  ]);
  return { phoneLogin, loginImage: loginImageFileId.length > 0 };
}

/** Public bytes for the image chosen in General settings. */
export async function readParticipantLoginImage(organizationSlug?: string) {
  const org = await resolveLoginOrganization(organizationSlug);
  const fileId = org ? await participantLoginImageFileId(org.id) : '';
  if (!org || !fileId) throw notFound('Login image not found.');
  return readInlineImage(org.id, fileId);
}
