import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { prisma } from '../src/lib/prisma.js';
import { rowToCreatePayload } from '../src/modules/banks/import-export.js';
import { clusterByPassage, saveSharedPassage } from '../src/modules/banks/passages.js';
import { createQuestion, exportQuestionsCsv } from '../src/modules/banks/service.js';

describe('passage question order', () => {
  it('pulls later questions of a passage up to the first one, in sort order', () => {
    const ordered = clusterByPassage([
      { id: 'solo-1', passageId: null, sortOrder: 0 },
      { id: 'p-b', passageId: 'p', sortOrder: 1 },
      { id: 'solo-2', passageId: null, sortOrder: 0 },
      { id: 'p-a', passageId: 'p', sortOrder: 0 },
    ]);
    assert.deepEqual(
      ordered.map((item) => item.id),
      ['solo-1', 'p-a', 'p-b', 'solo-2'],
    );
    const ids = ordered.map((item) => item.id);
    assert.equal(ids.indexOf('p-b'), ids.indexOf('p-a') + 1);
  });

  it('leaves a single passage question where it already stands', () => {
    const ordered = clusterByPassage([
      { id: 'a', passageId: 'p1', sortOrder: 0 },
      { id: 'b', passageId: null, sortOrder: 0 },
      { id: 'c', passageId: 'p2', sortOrder: 4 },
    ]);
    assert.deepEqual(
      ordered.map((item) => item.id),
      ['a', 'b', 'c'],
    );
  });
});

describe('shared passage storage', () => {
  const stamp = Date.now().toString(36);
  let organizationId = '';
  let bankId = '';
  let activityId = '';
  let studentId = '';

  after(async () => {
    if (activityId) {
      await prisma.attempt.deleteMany({ where: { activityId } });
      await prisma.activity.delete({ where: { id: activityId } }).catch(() => undefined);
    }
    if (bankId) {
      await prisma.questionBank.delete({ where: { id: bankId } }).catch(() => undefined);
    }
  });

  it('stores one passage for repeated text, edits it in place, and forks it after an attempt', async () => {
    const organization = await prisma.organization.findFirst();
    assert.ok(organization, 'expected a seeded organization');
    organizationId = organization.id;
    const student = await prisma.student.findFirst({ where: { organizationId } });
    assert.ok(student, 'expected a seeded student');
    studentId = student.id;

    const bank = await prisma.questionBank.create({
      data: {
        organizationId,
        kind: 'assessment',
        code: `QB-P-${stamp}`,
        name: 'Passage storage test',
        origin: 'reusable',
      },
    });
    bankId = bank.id;
    const activity = await prisma.activity.create({
      data: {
        organizationId,
        kind: 'assessment',
        code: `ASM-P-${stamp}`,
        name: 'Passage storage test',
      },
    });
    activityId = activity.id;

    const body = `The quick brown fox ${stamp}.`;
    const cache = new Map<string, string>();
    const first = await saveSharedPassage({ organizationId, bankId, body, cache });
    const second = await saveSharedPassage({ organizationId, bankId, body, cache });
    assert.equal(second.passageId, first.passageId);
    assert.equal(await prisma.passage.count({ where: { bankId, body } }), 1);

    const edited = await saveSharedPassage({
      organizationId,
      bankId,
      body: `${body} More.`,
      passageId: first.passageId,
    });
    assert.equal(edited.passageId, first.passageId);
    assert.equal(
      (await prisma.passage.findUniqueOrThrow({ where: { id: first.passageId } })).body,
      `${body} More.`,
    );

    const question = await prisma.question.create({
      data: {
        organizationId,
        bankId,
        code: `Q-P-${stamp}`,
        type: 'comprehension_mcq',
        question: 'What color is the fox?',
        points: 1,
        passageId: first.passageId,
        sortOrder: 0,
      },
    });
    const sibling = await prisma.question.create({
      data: {
        organizationId,
        bankId,
        code: `Q-S-${stamp}`,
        type: 'comprehension_mcq',
        question: 'Which animal is lazy?',
        points: 1,
        passageId: first.passageId,
        sortOrder: 1,
      },
    });
    const version = await prisma.questionVersion.create({
      data: {
        organizationId,
        questionId: question.id,
        version: 1,
        type: 'comprehension_mcq',
        question: question.question,
        points: 1,
        answerKey: { correctLabels: ['A'] },
        passageId: first.passageId,
      },
    });
    const siblingVersion = await prisma.questionVersion.create({
      data: {
        organizationId,
        questionId: sibling.id,
        version: 1,
        type: 'comprehension_mcq',
        question: sibling.question,
        points: 1,
        answerKey: { correctLabels: ['B'] },
        passageId: first.passageId,
      },
    });
    await prisma.attempt.create({
      data: {
        organizationId,
        activityId,
        studentId,
        startedAt: new Date(),
        deadlineAt: new Date(Date.now() + 60_000),
        questionOrder: [version.id, siblingVersion.id],
      },
    });

    const forkedBody = `${body} Forked.`;
    const forked = await saveSharedPassage({
      organizationId,
      bankId,
      body: forkedBody,
      passageId: first.passageId,
      editingQuestionId: question.id,
    });
    assert.notEqual(forked.passageId, first.passageId);
    assert.equal(
      (await prisma.passage.findUniqueOrThrow({ where: { id: first.passageId } })).body,
      `${body} More.`,
    );
    assert.equal(
      (await prisma.passage.findUniqueOrThrow({ where: { id: forked.passageId } })).body,
      forkedBody,
    );
    assert.equal(
      (await prisma.question.findUniqueOrThrow({ where: { id: question.id } })).passageId,
      forked.passageId,
    );
    assert.equal(
      (await prisma.questionVersion.findUniqueOrThrow({ where: { id: version.id } })).passageId,
      first.passageId,
    );

    const siblingVersions = await prisma.questionVersion.findMany({
      where: { questionId: sibling.id },
      orderBy: { version: 'asc' },
    });
    assert.equal(siblingVersions.length, 2);
    assert.equal(siblingVersions[0]?.passageId, first.passageId);
    assert.equal(siblingVersions[1]?.passageId, forked.passageId);
    assert.equal(
      (await prisma.question.findUniqueOrThrow({ where: { id: sibling.id } })).passageId,
      forked.passageId,
    );
  });

  it('imports two comprehension rows as one passage and exports that text on both', async () => {
    const organization = await prisma.organization.findFirst();
    assert.ok(organization);
    const actorUser = await prisma.user.findFirst({
      where: { memberships: { some: { organizationId: organization.id, role: 'super_admin' } } },
    });
    assert.ok(actorUser);
    const actor = {
      role: 'super_admin' as const,
      assessmentAccess: 'full' as const,
      quizAccess: 'full' as const,
    };
    const stamp = Date.now().toString(36);
    const body = `Shared import passage ${stamp}.`;
    const bank = await prisma.questionBank.create({
      data: {
        organizationId: organization.id,
        kind: 'assessment',
        code: `QB-IMP-${stamp}`,
        name: 'Passage import test',
        origin: 'reusable',
      },
    });

    try {
      const cache = new Map<string, string>();
      const sheetRow = (
        sheet: number,
        question: string,
        optionA: string,
        optionB: string,
        passageText: string,
      ) =>
        rowToCreatePayload({
          sheetRow: sheet,
          type: 'comprehension_mcq',
          question,
          points: '1',
          optionA,
          optionB,
          optionC: '',
          optionD: '',
          optionE: '',
          optionF: '',
          correct: 'A',
          numericValue: '',
          numericTolerance: '',
          referenceAnswer: '',
          stemImageUrl: '',
          optionA_imageUrl: '',
          optionB_imageUrl: '',
          optionC_imageUrl: '',
          optionD_imageUrl: '',
          optionE_imageUrl: '',
          optionF_imageUrl: '',
          passageText,
        });
      const first = sheetRow(2, 'What color is the fox?', 'Brown', 'Black', body);
      const second = sheetRow(3, 'What does the fox jump over?', 'A dog', 'A cat', `  ${body}  `);
      await createQuestion(organization.id, actorUser.id, actor, bank.id, first, cache);
      await createQuestion(organization.id, actorUser.id, actor, bank.id, second, cache);

      assert.equal(await prisma.passage.count({ where: { bankId: bank.id } }), 1);
      const questions = await prisma.question.findMany({
        where: { bankId: bank.id },
        orderBy: { sortOrder: 'asc' },
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      });
      assert.equal(questions.length, 2);
      assert.equal(questions[0]?.sortOrder, 0);
      assert.equal(questions[1]?.sortOrder, 1);
      assert.ok(questions[0]?.passageId);
      assert.equal(questions[0]?.passageId, questions[1]?.passageId);
      for (const question of questions) {
        const key = question.versions[0]?.answerKey;
        assert.equal(
          key && typeof key === 'object' && !Array.isArray(key) && 'passageText' in key,
          false,
        );
      }

      const csv = await exportQuestionsCsv(organization.id, actorUser.id, actor, bank.id);
      const exported = csv
        .trim()
        .split('\n')
        .filter((line) => line.includes('comprehension_mcq'));
      assert.equal(exported.length, 2);
      assert.ok(exported.every((line) => line.includes(body)));
    } finally {
      await prisma.questionBank.delete({ where: { id: bank.id } }).catch(() => undefined);
    }
  });
});
