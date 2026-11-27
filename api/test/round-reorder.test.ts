import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { prisma } from '../src/lib/prisma.js';
import { updateActivity } from '../src/modules/activities/service.js';

describe('assessment round reorder', () => {
  const created: { activityId?: string } = {};

  after(async () => {
    if (!created.activityId) return;
    await prisma.activity.delete({ where: { id: created.activityId } }).catch(() => undefined);
  });

  it('swaps round sortOrder without unique collisions', async () => {
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { slug: 'nextgeninnov8' },
    });
    const membership = await prisma.membership.findFirstOrThrow({
      where: { organizationId: organization.id, role: 'super_admin' },
    });
    const sponsor = await prisma.sponsor.findFirstOrThrow({
      where: { organizationId: organization.id },
    });
    const contest = await prisma.contest.findFirstOrThrow({
      where: { organizationId: organization.id, sponsorId: sponsor.id },
    });

    const activity = await prisma.activity.create({
      data: {
        organizationId: organization.id,
        kind: 'assessment',
        code: `ASM-REORDER-${Date.now()}`,
        name: 'Reorder rounds fixture',
        status: 'draft',
        sponsorId: sponsor.id,
        contestId: contest.id,
        rounds: {
          create: [
            {
              organizationId: organization.id,
              name: 'Round A',
              sortOrder: 0,
              durationMinutes: 30,
              passingPercent: 40,
            },
            {
              organizationId: organization.id,
              name: 'Round B',
              sortOrder: 1,
              durationMinutes: 30,
              passingPercent: 40,
            },
          ],
        },
      },
      include: { rounds: { orderBy: { sortOrder: 'asc' } } },
    });
    created.activityId = activity.id;
    const [first, second] = activity.rounds;
    assert.ok(first && second);

    const updated = await updateActivity(
      organization.id,
      membership.userId,
      {
        role: 'super_admin',
        assessmentAccess: 'full',
        quizAccess: 'full',
      },
      activity.id,
      {
        rounds: [
          {
            id: second.id,
            name: second.name,
            sortOrder: 0,
            durationMinutes: 30,
            passingPercent: 40,
            bankIds: [],
          },
          {
            id: first.id,
            name: first.name,
            sortOrder: 1,
            durationMinutes: 30,
            passingPercent: 40,
            bankIds: [],
          },
        ],
      },
    );

    assert.deepEqual(
      updated.rounds?.map((round) => ({
        id: round.id,
        sortOrder: round.sortOrder,
        name: round.name,
      })),
      [
        { id: second.id, sortOrder: 0, name: 'Round B' },
        { id: first.id, sortOrder: 1, name: 'Round A' },
      ],
    );
  });
});
