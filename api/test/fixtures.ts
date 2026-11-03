import { prisma } from '../src/lib/prisma.js';

const ORG_SLUG = 'nextgeninnov8';

async function orgAndParticipant(email: string) {
  const organization = await prisma.organization.findUniqueOrThrow({ where: { slug: ORG_SLUG } });
  const participant = await prisma.participant.findFirstOrThrow({
    where: { organizationId: organization.id, email },
  });
  return { organization, participant };
}

/** Assessment with one round, used by tests that start a round attempt. */
export async function ensureRoundAssessment(participantEmail = 'participant1@mail.com') {
  const { organization, participant } = await orgAndParticipant(participantEmail);
  const existing = await prisma.activity.findFirst({
    where: { organizationId: organization.id, code: 'ASM-ROUND' },
    include: { rounds: { orderBy: { sortOrder: 'asc' }, take: 1 } },
  });
  if (existing?.rounds[0]) {
    await prisma.registration.upsert({
      where: {
        organizationId_activityId_participantId: {
          organizationId: organization.id,
          activityId: existing.id,
          participantId: participant.id,
        },
      },
      update: { status: 'assigned' },
      create: {
        organizationId: organization.id,
        activityId: existing.id,
        participantId: participant.id,
        status: 'assigned',
        assignedAt: new Date(),
      },
    });
    return { activity: existing, round: existing.rounds[0] };
  }

  const bank = await prisma.questionBank.create({
    data: {
      organizationId: organization.id,
      kind: 'assessment',
      code: 'QB-ROUND',
      name: 'Round fixture',
      status: 'active',
      origin: 'reusable',
    },
  });
  const question = await prisma.question.create({
    data: {
      organizationId: organization.id,
      bankId: bank.id,
      code: 'RQ-1',
      type: 'single_mcq',
      question: 'What is 2 + 2?',
      points: 1,
    },
  });
  const version = await prisma.questionVersion.create({
    data: {
      organizationId: organization.id,
      questionId: question.id,
      version: 1,
      type: 'single_mcq',
      question: 'What is 2 + 2?',
      points: 1,
      answerKey: { correctLabels: ['A'] },
    },
  });
  await prisma.questionOption.createMany({
    data: [
      {
        questionId: question.id,
        questionVersionId: version.id,
        label: 'A',
        body: '4',
        sortOrder: 0,
        isCorrect: true,
      },
      {
        questionId: question.id,
        questionVersionId: version.id,
        label: 'B',
        body: '5',
        sortOrder: 1,
        isCorrect: false,
      },
    ],
  });
  const now = new Date();
  const activity = await prisma.activity.create({
    data: {
      organizationId: organization.id,
      kind: 'assessment',
      code: 'ASM-ROUND',
      name: 'Round fixture',
      status: 'active',
      startsAt: new Date(now.getTime() - 86_400_000),
      endsAt: new Date(now.getTime() + 30 * 86_400_000),
      durationMinutes: 30,
    },
  });
  const round = await prisma.activityRound.create({
    data: {
      organizationId: organization.id,
      activityId: activity.id,
      name: 'Round 1',
      sortOrder: 0,
      durationMinutes: 30,
    },
  });
  await prisma.activityRoundBank.create({
    data: { organizationId: organization.id, roundId: round.id, bankId: bank.id },
  });
  await prisma.registration.create({
    data: {
      organizationId: organization.id,
      activityId: activity.id,
      participantId: participant.id,
      status: 'assigned',
      assignedAt: now,
    },
  });
  return { activity, round };
}

async function publishedResult(input: {
  organizationId: string;
  activityId: string;
  participantId: string;
  roundId?: string;
  versionId: string;
}) {
  const existing = await prisma.result.findFirst({
    where: {
      organizationId: input.organizationId,
      activityId: input.activityId,
      participantId: input.participantId,
    },
  });
  if (existing) return existing;
  const now = new Date();
  const attempt = await prisma.attempt.create({
    data: {
      organizationId: input.organizationId,
      activityId: input.activityId,
      roundId: input.roundId,
      participantId: input.participantId,
      status: 'submitted',
      revision: 1,
      startedAt: new Date(now.getTime() - 60_000),
      deadlineAt: new Date(now.getTime() + 60_000),
      submittedAt: now,
      questionOrder: [input.versionId],
      isAuthoritative: true,
      responses: {
        create: {
          organizationId: input.organizationId,
          questionVersionId: input.versionId,
          answer: { label: 'A' },
          revision: 1,
        },
      },
    },
  });
  return prisma.result.create({
    data: {
      organizationId: input.organizationId,
      attemptId: attempt.id,
      activityId: input.activityId,
      participantId: input.participantId,
      score: 1,
      maxScore: 1,
      percent: 100,
      passed: true,
      releaseStatus: 'published',
      publishedAt: now,
    },
  });
}

/** Published assessment (answers visible) and quiz (answers hidden) for review policy tests. */
export async function ensureReviewResults(participantEmail = 'participant2@mail.com') {
  const { organization, participant } = await orgAndParticipant(participantEmail);
  const round = await ensureRoundAssessment(participantEmail);
  const question = await prisma.question.findFirstOrThrow({
    where: { organizationId: organization.id, code: 'RQ-1' },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  });
  const version = question.versions[0];
  if (!version) throw new Error('Round fixture question has no version.');
  await publishedResult({
    organizationId: organization.id,
    activityId: round.activity.id,
    participantId: participant.id,
    roundId: round.round.id,
    versionId: version.id,
  });

  let hidden = await prisma.activity.findFirst({
    where: { organizationId: organization.id, code: 'QZ-HIDDEN' },
  });
  if (!hidden) {
    let bank = await prisma.questionBank.findFirst({
      where: { organizationId: organization.id, code: 'QB-HIDDEN' },
    });
    if (!bank) {
      bank = await prisma.questionBank.create({
        data: {
          organizationId: organization.id,
          kind: 'quiz',
          code: 'QB-HIDDEN',
          name: 'Hidden answers',
          status: 'active',
          origin: 'quiz_local',
        },
      });
    }
    let question = await prisma.question.findFirst({
      where: { organizationId: organization.id, bankId: bank.id, code: 'HQ-1' },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    let hiddenVersion = question?.versions[0] ?? null;
    if (!question) {
      question = await prisma.question.create({
        data: {
          organizationId: organization.id,
          bankId: bank.id,
          code: 'HQ-1',
          type: 'single_mcq',
          question: 'What is 1 + 1?',
          points: 1,
        },
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      });
    }
    if (!hiddenVersion) {
      hiddenVersion = await prisma.questionVersion.create({
        data: {
          organizationId: organization.id,
          questionId: question.id,
          version: 1,
          type: 'single_mcq',
          question: 'What is 1 + 1?',
          points: 1,
          answerKey: { correctLabels: ['A'] },
        },
      });
      await prisma.questionOption.createMany({
        data: [
          {
            questionId: question.id,
            questionVersionId: hiddenVersion.id,
            label: 'A',
            body: '2',
            sortOrder: 0,
            isCorrect: true,
          },
          {
            questionId: question.id,
            questionVersionId: hiddenVersion.id,
            label: 'B',
            body: '3',
            sortOrder: 1,
            isCorrect: false,
          },
        ],
      });
    }
    hidden = await prisma.activity.create({
      data: {
        organizationId: organization.id,
        kind: 'quiz',
        code: 'QZ-HIDDEN',
        name: 'Hidden quiz',
        status: 'completed',
        startsAt: new Date(Date.now() - 86_400_000),
        endsAt: new Date(Date.now() - 3_600_000),
        durationMinutes: 10,
        settings: {
          quiz: {
            shuffleQuestions: false,
            shuffleOptions: false,
            scoreRelease: 'after_publish',
            answersVisibleToParticipant: false,
            maxAttempts: 1,
          },
        },
        activityBanks: { create: { organizationId: organization.id, bankId: bank.id } },
      },
    });
    await prisma.registration.create({
      data: {
        organizationId: organization.id,
        activityId: hidden.id,
        participantId: participant.id,
        status: 'assigned',
        assignedAt: new Date(),
      },
    });
    await publishedResult({
      organizationId: organization.id,
      activityId: hidden.id,
      participantId: participant.id,
      versionId: hiddenVersion.id,
    });
  }
}
