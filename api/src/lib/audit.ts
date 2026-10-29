import type { ActorType, Prisma } from '#prisma';
import { prisma } from './prisma.js';

export async function writeAudit(input: {
  organizationId: string;
  actorType: ActorType;
  actorUserId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.auditEvent.create({
    data: {
      organizationId: input.organizationId,
      actorType: input.actorType,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
}
