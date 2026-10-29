import type { Prisma } from '#prisma';
import { prisma } from '../../lib/prisma.js';

// The extended Prisma client and its transaction client are not mutually
// assignable. Both expose the same model delegates at runtime.
type PassageDb = typeof prisma;

export function normalizePassageBody(body: string): string {
  return body.trim();
}

export function stripPassageText(answerKey: Record<string, unknown>): Record<string, unknown> {
  const next = { ...answerKey };
  delete next.passageText;
  return next;
}

export type PassageClusterItem = {
  id: string;
  passageId: string | null;
  sortOrder: number;
};

/** Keep questions that share a passage together, in sort order, at the first question's place. */
export function clusterByPassage<T extends PassageClusterItem>(items: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    if (!item.passageId) continue;
    const list = groups.get(item.passageId) ?? [];
    list.push(item);
    groups.set(item.passageId, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  }

  const emitted = new Set<string>();
  const ordered: T[] = [];
  for (const item of items) {
    if (emitted.has(item.id)) continue;
    const group = item.passageId ? groups.get(item.passageId) : undefined;
    const batch = group && group.length > 0 ? group : [item];
    for (const sibling of batch) {
      if (emitted.has(sibling.id)) continue;
      ordered.push(sibling);
      emitted.add(sibling.id);
    }
  }
  return ordered;
}

async function passageIsPinned(db: PassageDb, passageId: string): Promise<boolean> {
  const versions = await db.questionVersion.findMany({
    where: { passageId },
    select: { id: true },
  });
  if (versions.length === 0) return false;
  const hit = await db.attempt.findFirst({
    where: { questionOrder: { hasSome: versions.map((version) => version.id) } },
    select: { id: true },
  });
  return Boolean(hit);
}

async function nextPassageSort(db: PassageDb, passageId: string): Promise<number> {
  const agg = await db.question.aggregate({
    where: { passageId },
    _max: { sortOrder: true },
  });
  return (agg._max.sortOrder ?? -1) + 1;
}

async function forkSiblings(
  db: PassageDb,
  oldPassageId: string,
  newPassageId: string,
  editingQuestionId?: string,
) {
  const siblings = await db.question.findMany({
    where: {
      passageId: oldPassageId,
      ...(editingQuestionId ? { id: { not: editingQuestionId } } : {}),
    },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        take: 1,
        include: { options: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  });

  for (const sibling of siblings) {
    await db.question.update({
      where: { id: sibling.id },
      data: { passageId: newPassageId },
    });
    const latest = sibling.versions[0];
    if (!latest) continue;
    const answerKey = stripPassageText(
      latest.answerKey && typeof latest.answerKey === 'object' && !Array.isArray(latest.answerKey)
        ? (latest.answerKey as Record<string, unknown>)
        : {},
    );
    const created = await db.questionVersion.create({
      data: {
        organizationId: sibling.organizationId,
        questionId: sibling.id,
        version: latest.version + 1,
        type: latest.type,
        question: latest.question,
        points: latest.points,
        answerKey: answerKey as Prisma.InputJsonValue,
        passageId: newPassageId,
      },
    });
    if (latest.options.length > 0) {
      await db.questionOption.createMany({
        data: latest.options.map((option) => ({
          questionId: sibling.id,
          questionVersionId: created.id,
          label: option.label,
          body: option.body,
          imageUrl: option.imageUrl,
          sortOrder: option.sortOrder,
          isCorrect: option.isCorrect,
        })),
      });
    }
  }
}

/**
 * Store one passage body per bank. Editing a passage that an attempt already
 * uses creates a new row and leaves the previous row on the old versions.
 */
export async function saveSharedPassage(
  input: {
    organizationId: string;
    bankId: string;
    body: string;
    passageId?: string | null;
    editingQuestionId?: string;
    cache?: Map<string, string>;
  },
  db: PassageDb = prisma,
): Promise<{ passageId: string; sortOrder: number }> {
  const body = normalizePassageBody(input.body);
  if (!body) throw new Error('Passage text is required.');
  const cached = input.cache?.get(body);
  if (cached) {
    return { passageId: cached, sortOrder: await nextPassageSort(db, cached) };
  }

  if (input.passageId) {
    const existing = await db.passage.findFirst({
      where: { id: input.passageId, organizationId: input.organizationId, bankId: input.bankId },
    });
    if (existing && normalizePassageBody(existing.body) === body) {
      input.cache?.set(body, existing.id);
      return { passageId: existing.id, sortOrder: await nextPassageSort(db, existing.id) };
    }
    if (existing) {
      const pinned = await passageIsPinned(db, existing.id);
      if (!pinned) {
        await db.passage.update({ where: { id: existing.id }, data: { body } });
        input.cache?.set(body, existing.id);
        return { passageId: existing.id, sortOrder: await nextPassageSort(db, existing.id) };
      }
      const fork = async (tx: PassageDb) => {
        const created = await tx.passage.create({
          data: {
            organizationId: input.organizationId,
            bankId: input.bankId,
            title: existing.title,
            body,
          },
        });
        if (input.editingQuestionId) {
          await tx.question.update({
            where: { id: input.editingQuestionId },
            data: { passageId: created.id },
          });
        }
        await forkSiblings(tx, existing.id, created.id, input.editingQuestionId);
        input.cache?.set(body, created.id);
        return { passageId: created.id, sortOrder: await nextPassageSort(tx, created.id) };
      };
      if (db === prisma) {
        return prisma.$transaction((tx) => fork(tx as PassageDb), { timeout: 20_000 });
      }
      return fork(db);
    }
  }

  const match = await db.passage.findFirst({
    where: { organizationId: input.organizationId, bankId: input.bankId, body },
  });
  if (match) {
    input.cache?.set(body, match.id);
    return { passageId: match.id, sortOrder: await nextPassageSort(db, match.id) };
  }

  const created = await db.passage.create({
    data: {
      organizationId: input.organizationId,
      bankId: input.bankId,
      body,
    },
  });
  input.cache?.set(body, created.id);
  return { passageId: created.id, sortOrder: 0 };
}
