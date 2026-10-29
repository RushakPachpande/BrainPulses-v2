import type { Prisma, SettingGroup } from '#prisma';
import { writeAudit } from '../../lib/audit.js';
import { prisma } from '../../lib/prisma.js';

const DEFAULTS: Record<SettingGroup, Record<string, unknown>> = {
  general: {
    orgDisplayName: 'BrainPulses',
    organizationName: 'BrainPulses Learning Pvt. Ltd.',
    timezone: 'Asia/Kolkata',
    locale: 'en-IN',
    dateFormat: 'DD MMM YYYY',
    timeFormat: '12-hour',
    studentPageOverview: true,
    studentPageQuizzes: true,
    studentPageAssessments: true,
    studentPageResults: true,
    studentPageProfile: true,
    studentPageHelp: true,
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
  for (const [key, value] of Object.entries(values)) {
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

  if (group === 'general' && typeof values.organizationName === 'string') {
    const name = values.organizationName.trim();
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
    metadata: values as Prisma.InputJsonValue,
  });

  return getSettings(organizationId, group);
}
