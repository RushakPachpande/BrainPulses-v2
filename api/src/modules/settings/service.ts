import type { Prisma, SettingGroup } from '#prisma';
import { writeAudit } from '../../lib/audit.js';
import { badRequest } from '../../lib/errors.js';
import { PARTICIPANT_LOGIN_IMAGE_KEY } from '../../lib/participant-login.js';
import { prisma } from '../../lib/prisma.js';
import { placeOwnedImage } from '../files/place.js';
import { assertCatalogImage } from '../files/service.js';

const DEFAULTS: Record<SettingGroup, Record<string, unknown>> = {
  general: {
    orgDisplayName: 'BrainPulses',
    organizationName: 'BrainPulses Learning Pvt. Ltd.',
    participantPageOverview: true,
    participantPageQuizzes: true,
    participantPageAssessments: true,
    participantPageResults: true,
    participantPageProfile: true,
    participantPageHelp: true,
    participantPhoneLogin: true,
  },
};

export async function getSettings(organizationId: string, group: SettingGroup) {
  const rows = await prisma.setting.findMany({
    where: { organizationId, group },
  });
  const values = { ...DEFAULTS[group] };
  for (const row of rows) {
    values[row.key] = row.value;
  }

  if (group === 'general') {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    if (org) {
      values.organizationName = org.name;
    }
  }

  return { group, values };
}

export async function patchSettings(
  organizationId: string,
  actorUserId: string,
  group: SettingGroup,
  values: Record<string, unknown>,
) {
  const next = { ...values };
  if (group === 'general' && PARTICIPANT_LOGIN_IMAGE_KEY in next) {
    const raw = next[PARTICIPANT_LOGIN_IMAGE_KEY];
    if (raw === null || raw === '') {
      await prisma.setting.deleteMany({
        where: { organizationId, group, key: PARTICIPANT_LOGIN_IMAGE_KEY },
      });
      delete next[PARTICIPANT_LOGIN_IMAGE_KEY];
    } else if (typeof raw !== 'string') {
      throw badRequest('Login image is invalid.');
    } else {
      const fileId = raw.trim();
      await assertCatalogImage(organizationId, fileId);
      const placed = await placeOwnedImage(organizationId, fileId, { kind: 'login' });
      if (placed === 'missing') {
        throw badRequest('Upload an image before saving.');
      }
      next[PARTICIPANT_LOGIN_IMAGE_KEY] = fileId;
    }
  }

  for (const [key, value] of Object.entries(next)) {
    await prisma.setting.upsert({
      where: {
        organizationId_group_key: { organizationId, group, key },
      },
      create: {
        organizationId,
        group,
        key,
        value: value as Prisma.InputJsonValue,
      },
      update: { value: value as Prisma.InputJsonValue },
    });
  }

  if (group === 'general' && typeof next.organizationName === 'string') {
    const name = next.organizationName.trim();
    if (name) {
      await prisma.organization.update({
        where: { id: organizationId },
        data: { name },
      });
    }
  }

  await writeAudit({
    organizationId,
    actorType: 'user',
    actorUserId,
    action: 'settings.update',
    targetType: 'settings',
    targetId: group,
    metadata: next as Prisma.InputJsonValue,
  });

  return getSettings(organizationId, group);
}
