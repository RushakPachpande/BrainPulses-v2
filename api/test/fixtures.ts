import { prisma } from '../src/lib/prisma.js';

const ORG_SLUG = 'nextgeninnov8';

async function orgAndStudent(email: string) {
  const organization = await prisma.organization.findUniqueOrThrow({ where: { slug: ORG_SLUG } });
  const student = await prisma.student.findFirstOrThrow({
    where: { organizationId: organization.id, email },
  });
  return { organization, student };
}

/** Assessment with one round, used by tests that start a round attempt. */
export async function ensureRoundAssessment(studentEmail = 'student1@mail.com') {
  const { organization, student } = await orgAndStudent(studentEmail);
  const existing = await prisma.activity.findFirst({
    where: { organizationId: organization.id, code: 'ASM-ROUND' },
    include: { rounds: { orderBy: { sortOrder: 'asc' }, take: 1 } },
  });
  if (existing?.rounds[0]) {
    await prisma.registration.upsert({
      where: {
        organizationId_activityId_studentId: {
          organizationId: organization.id,
          activityId: existing.id,
          studentId: student.id,
        },
      },
      update: { status: 'assigned' },
      create: {
        organizationId: organization.id,
        activityId: existing.id,
        studentId: student.id,
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
      studentId: student.id,
      status: 'assigned',
      assignedAt: now,
    },
  });
  return { activity, round };
}

async function publishedResult(input: {
  organizationId: string;
  activityId: string;
  studentId: string;
  roundId?: string;
  versionId: string;
}) {
  const existing = await prisma.result.findFirst({
    where: {
      organizationId: input.organizationId,
      activityId: input.activityId,
      studentId: input.studentId,
    },
  });
  if (existing) return existing;
  const now = new Date();
  const attempt = await prisma.attempt.create({
    data: {
      organizationId: input.organizationId,
      activityId: input.activityId,
      roundId: input.roundId,
      studentId: input.studentId,
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
      studentId: input.studentId,
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
export async function ensureReviewResults(studentEmail = 'student2@mail.com') {
  const { organization, student } = await orgAndStudent(studentEmail);
  const round = await ensureRoundAssessment(studentEmail);
  const question = await prisma.question.findFirstOrThrow({
    where: { organizationId: organization.id, code: 'RQ-1' },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  });
  const version = question.versions[0];
  if (!version) throw new Error('Round fixture question has no version.');
  await publishedResult({
    organizationId: organization.id,
    activityId: round.activity.id,
    studentId: student.id,
    roundId: round.round.id,
    versionId: version.id,
  });

  let hidden = await prisma.activity.findFirst({
    where: { organizationId: organization.id, code: 'QZ-HIDDEN' },
  });
  if (!hidden) {
    const bank = await prisma.questionBank.create({
      data: {
        organizationId: organization.id,
        kind: 'quiz',
        code: 'QB-HIDDEN',
        name: 'Hidden answers',
        status: 'active',
        origin: 'reusable',
      },
    });
    const question = await prisma.question.create({
      data: {
        organizationId: organization.id,
        bankId: bank.id,
        code: 'HQ-1',
        type: 'single_mcq',
        question: 'What is 1 + 1?',
        points: 1,
      },
    });
    const hiddenVersion = await prisma.questionVersion.create({
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
            scoreVisibleToStudent: true,
            answersVisibleToStudent: false,
            dailyLeaderboardVisible: false,
            overallLeaderboardVisible: false,
            dailyGroupLeaderboardVisible: false,
            overallGroupLeaderboardVisible: false,
            countsForGroupLeaderboard: false,
            leaderboardReleasedAt: null,
          },
        },
        activityBanks: { create: { organizationId: organization.id, bankId: bank.id } },
      },
    });
    await prisma.registration.create({
      data: {
        organizationId: organization.id,
        activityId: hidden.id,
        studentId: student.id,
        status: 'assigned',
        assignedAt: new Date(),
      },
    });
    await publishedResult({
      organizationId: organization.id,
      activityId: hidden.id,
      studentId: student.id,
      versionId: hiddenVersion.id,
    });
  }
}
