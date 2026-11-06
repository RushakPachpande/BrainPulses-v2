import { rename } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import {
  fileIdsInAnswerKey,
  fileIdsInText,
  moveUploadFile,
  type ImageDestination,
} from './paths.js';

export async function placeOwnedImage(
  organizationId: string,
  fileId: string | null | undefined,
  dest: ImageDestination,
): Promise<'moved' | 'left' | 'missing'> {
  if (!fileId) return 'missing';
  const file = await prisma.fileObject.findFirst({
    where: { organizationId, id: fileId },
    select: { id: true, storagePath: true },
  });
  if (!file) return 'missing';

  const root = path.resolve(env.UPLOAD_DIR);
  const previousPath = file.storagePath;
  const moved = await moveUploadFile(root, previousPath, organizationId, dest);
  if (moved.status !== 'moved') return moved.status;

  try {
    await prisma.fileObject.update({
      where: { id: file.id },
      data: { storagePath: moved.storagePath },
    });
  } catch (err) {
    await rename(moved.storagePath, previousPath).catch(() => undefined);
    throw err;
  }
  return 'moved';
}

export async function destinationForBank(
  organizationId: string,
  bankId: string,
): Promise<ImageDestination | null> {
  const bank = await prisma.questionBank.findFirst({
    where: { organizationId, id: bankId },
    select: { id: true, name: true, kind: true, origin: true },
  });
  if (!bank) return null;

  if (bank.origin === 'round_local') {
    const round = await prisma.activityRound.findFirst({
      where: { organizationId, localBankId: bank.id },
      select: {
        id: true,
        name: true,
        activity: { select: { id: true, name: true } },
      },
    });
    if (!round) return null;
    return {
      kind: 'round-questions',
      activityName: round.activity.name,
      activityId: round.activity.id,
      roundName: round.name,
      roundId: round.id,
    };
  }

  if (bank.origin === 'quiz_local') {
    const link = await prisma.activityBank.findFirst({
      where: { organizationId, bankId: bank.id },
      select: { activity: { select: { id: true, name: true, kind: true } } },
    });
    if (!link || link.activity.kind !== 'quiz') return null;
    return {
      kind: 'quiz-questions',
      activityName: link.activity.name,
      activityId: link.activity.id,
    };
  }

  return {
    kind: 'reusable-bank',
    bankKind: bank.kind,
    bankName: bank.name,
    bankId: bank.id,
  };
}

export async function placeQuestionImages(
  organizationId: string,
  bankId: string,
  answerKey: unknown,
  options: { imageUrl?: string | null }[],
) {
  const dest = await destinationForBank(organizationId, bankId);
  if (!dest) return;
  const ids = new Set<string>([
    ...fileIdsInAnswerKey(answerKey),
    ...options.flatMap((option) => fileIdsInText(option.imageUrl)),
  ]);
  for (const id of ids) {
    await placeOwnedImage(organizationId, id, dest);
  }
}

export async function placeActivityImages(
  organizationId: string,
  activity: {
    id: string;
    name: string;
    kind: 'assessment' | 'quiz';
    imageFileId: string | null;
    rounds?: { id: string; name: string; imageFileId: string | null }[];
  },
) {
  await placeOwnedImage(organizationId, activity.imageFileId, {
    kind: 'activity',
    activityKind: activity.kind,
    activityName: activity.name,
    activityId: activity.id,
  });
  if (activity.kind !== 'assessment' || !activity.rounds) return;
  for (const round of activity.rounds) {
    await placeOwnedImage(organizationId, round.imageFileId, {
      kind: 'round',
      activityName: activity.name,
      activityId: activity.id,
      roundName: round.name,
      roundId: round.id,
    });
  }
}
