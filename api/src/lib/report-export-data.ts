import { prisma } from './prisma.js';
import type { AttemptAnswers, ExportQuestion, ParticipantProfile } from './report-workbook.js';

function asNumber(value: { toString(): string } | number): number {
  return typeof value === 'number' ? value : Number(value);
}

export async function loadParticipantProfiles(
  organizationId: string,
  registrationIds: string[],
): Promise<Map<string, ParticipantProfile>> {
  const profiles = new Map<string, ParticipantProfile>();
  if (registrationIds.length === 0) return profiles;
  const registrations = await prisma.registration.findMany({
    where: { organizationId, id: { in: registrationIds } },
    select: {
      id: true,
      participant: { select: { course: true, cohort: true, city: true } },
    },
  });
  for (const registration of registrations) {
    profiles.set(registration.id, {
      course: registration.participant.course,
      cohort: registration.participant.cohort,
      city: registration.participant.city,
    });
  }
  return profiles;
}

export async function loadAttemptQuestions(
  organizationId: string,
  attemptIds: string[],
): Promise<{ attempts: Map<string, AttemptAnswers>; questions: Map<string, ExportQuestion> }> {
  const attempts = new Map<string, AttemptAnswers>();
  const questions = new Map<string, ExportQuestion>();
  if (attemptIds.length === 0) return { attempts, questions };

  const rows = await prisma.attempt.findMany({
    where: { organizationId, id: { in: attemptIds } },
    select: {
      id: true,
      startedAt: true,
      disqualified: true,
      questionOrder: true,
      responses: { select: { questionVersionId: true, answer: true } },
    },
  });

  const versionIds = new Set<string>();
  for (const row of rows) {
    const questionIds = [...row.questionOrder];
    const seen = new Set(questionIds);
    const answers = new Map<string, unknown>();
    for (const response of row.responses) {
      answers.set(response.questionVersionId, response.answer);
      if (!seen.has(response.questionVersionId)) {
        seen.add(response.questionVersionId);
        questionIds.push(response.questionVersionId);
      }
    }
    for (const id of questionIds) versionIds.add(id);
    attempts.set(row.id, {
      startedAt: row.startedAt.toISOString(),
      disqualified: row.disqualified,
      questionIds,
      answers,
    });
  }

  if (versionIds.size === 0) return { attempts, questions };
  const versions = await prisma.questionVersion.findMany({
    where: { organizationId, id: { in: [...versionIds] } },
    select: {
      id: true,
      type: true,
      question: true,
      points: true,
      answerKey: true,
      parentQuestion: { select: { sortOrder: true, code: true } },
      options: {
        orderBy: { sortOrder: 'asc' },
        select: { label: true, body: true, isCorrect: true },
      },
    },
  });
  for (const version of versions) {
    questions.set(version.id, {
      id: version.id,
      sortOrder: version.parentQuestion.sortOrder,
      code: version.parentQuestion.code,
      question: version.question,
      type: version.type,
      points: asNumber(version.points),
      answerKey: version.answerKey,
      options: version.options.map((option) => ({
        label: option.label,
        body: option.body,
        isCorrect: option.isCorrect,
      })),
    });
  }
  return { attempts, questions };
}
