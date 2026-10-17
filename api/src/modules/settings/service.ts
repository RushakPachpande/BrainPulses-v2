import type { Prisma, SettingGroup } from '#prisma';
import { writeAudit } from '../../lib/audit.js';
import { prisma } from '../../lib/prisma.js';

const DEFAULTS: Record<SettingGroup, Record<string, unknown>> = {
  general: {
    orgDisplayName: 'BrainPulses',
    timezone: 'Asia/Kolkata',
    locale: 'en-IN',
  },
  access: {
    allowStudentSelfRegister: false,
    sessionTimeoutMinutes: 15,
  },
  notifications: {
    studentRegistration: true,
    assessmentCompletion: true,
    quizCompletion: true,
    adminChanges: true,
    emailSummaries: true,
    dailyDigest: false,
  },
  system: {
    maintenanceMode: false,
    requireTwoFactor: false,
    supportEmail: 'support@brainpulses.example',
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
