import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { prisma } from '../src/lib/prisma.js';
import { defaultFields, type FormField } from '../src/modules/contest-forms/rules.js';
import { getTestApp, request } from './helpers.js';

async function adminToken() {
  const app = await getTestApp();
  const signIn = await request(app, 'POST', '/api/auth/sign-in', {
    body: { email: 'admin@brainpulses.com', password: 'Password123!' },
  });
  const data = (signIn.body as { data: Record<string, unknown> }).data;
  if (data.status === 'authenticated') {
    return (data.session as { accessToken: string }).accessToken;
  }
  const orgs = data.organizations as { id: string; slug: string }[];
  const org = orgs.find((o) => o.slug === 'nextgeninnov8') ?? orgs[0]!;
  const selected = await request(app, 'POST', '/api/auth/select-organization', {
    body: { selectionToken: data.selectionToken, organizationId: org.id },
  });
  return (selected.body as { data: { session: { accessToken: string } } }).data.session.accessToken;
}

const run = Date.now().toString(36);
const city: FormField = {
  id: 'city',
  key: 'city',
  locked: false,
  label: 'City',
  type: 'dropdown',
  required: true,
  options: [
    { id: 'pune', label: 'Pune' },
    { id: 'blr', label: 'Bengaluru' },
  ],
};
const fields = [...defaultFields().filter((field) => field.key !== 'gender'), city];

type Ctx = {
  organizationId: string;
  contestId: string;
  sponsorId: string;
  a: string;
  b: string;
  c: string;
  formId: string;
  slug: string;
};
const ctx = {} as Ctx;

async function statusFor(email: string, activityId: string) {
  const person = await prisma.participant.findFirstOrThrow({ where: { email } });
  const row = await prisma.registration.findFirst({
    where: { participantId: person.id, activityId },
  });
  return row?.status ?? 'none';
}

describe('contest form rules through the API', () => {
  before(async () => {
    const org = await prisma.organization.findUniqueOrThrow({ where: { slug: 'nextgeninnov8' } });
    ctx.organizationId = org.id;
    const image = await prisma.fileObject.findFirstOrThrow({
      where: { organizationId: org.id, mimeType: { startsWith: 'image/' } },
    });
    const sponsor = await prisma.sponsor.create({
      data: { organizationId: org.id, name: `Flow sponsor ${run}`, imageFileId: image.id },
    });
    const contest = await prisma.contest.create({
      data: {
        organizationId: org.id,
        sponsorId: sponsor.id,
        name: `Flow contest ${run}`,
        imageFileId: image.id,
      },
    });
    ctx.sponsorId = sponsor.id;
    ctx.contestId = contest.id;
    const make = async (code: string) =>
      (
        await prisma.activity.create({
          data: {
            organizationId: org.id,
            kind: 'quiz',
            code: `${code}-${run}`,
            name: `${code} ${run}`,
            status: 'active',
            sponsorId: sponsor.id,
            contestId: contest.id,
          },
        })
      ).id;
    ctx.a = await make('FA');
    ctx.b = await make('FB');
    ctx.c = await make('FC');
  });

  after(async () => {
    const submissions = await prisma.contestFormSubmission.findMany({
      where: { formId: ctx.formId },
      select: { participantId: true },
    });
    await prisma.participant.deleteMany({
      where: { id: { in: submissions.map((row) => row.participantId) } },
    });
    if (ctx.formId) await prisma.contestRegistrationForm.delete({ where: { id: ctx.formId } });
    await prisma.activity.deleteMany({ where: { id: { in: [ctx.a, ctx.b, ctx.c] } } });
    await prisma.contest.delete({ where: { id: ctx.contestId } });
    await prisma.sponsor.delete({ where: { id: ctx.sponsorId } });
  });

  it('publishes a rules form and assigns by answers at registration', async () => {
    const app = await getTestApp();
    const headers = { authorization: `Bearer ${await adminToken()}` };
    const created = await request(app, 'POST', '/api/contest-forms', {
      headers,
      body: {
        mode: 'save',
        sponsorId: ctx.sponsorId,
        contestId: ctx.contestId,
        opensAt: new Date(Date.now() - 3_600_000).toISOString(),
        closesAt: new Date(Date.now() + 86_400_000).toISOString(),
        fields,
        assignmentMode: 'rules',
        rules: [
          {
            id: 'r1',
            joins: [],
            conditions: [{ id: 'c1', fieldId: 'city', op: 'is', optionId: 'pune' }],
            activityIds: [ctx.a],
          },
        ],
        fallbackActivityIds: [ctx.c],
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const form = (created.body as { data: { id: string; slug: string; quizzes: { id: string }[] } })
      .data;
    ctx.formId = form.id;
    ctx.slug = form.slug;
    // The form's activity list is everything the rules and fallback can give.
    assert.deepEqual(form.quizzes.map((quiz) => quiz.id).sort(), [ctx.a, ctx.c].sort());

    const register = (first: string, cityId: string) =>
      request(app, 'POST', `/api/public/contest-forms/${ctx.slug}/register`, {
        body: {
          answers: {
            first_name: first,
            last_name: 'Test',
            email: `${first.toLowerCase()}-${run}@example.com`,
            mobile: `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
            city: cityId,
            terms: true,
          },
        },
      });
    const pune = await register('Asha', 'pune');
    assert.equal(pune.status, 201, JSON.stringify(pune.body));
    const puneData = (pune.body as { data: { activities: { id: string }[] } }).data;
    assert.deepEqual(
      puneData.activities.map((item) => item.id),
      [ctx.a],
    );
    const blr = await register('Bina', 'blr');
    assert.equal(blr.status, 201, JSON.stringify(blr.body));

    assert.equal(await statusFor(`asha-${run}@example.com`, ctx.a), 'assigned');
    assert.equal(await statusFor(`asha-${run}@example.com`, ctx.c), 'none');
    assert.equal(await statusFor(`bina-${run}@example.com`, ctx.c), 'assigned');

    const wrongCity = await register('Cara', 'Mumbai');
    assert.equal(wrongCity.status, 400);
  });

  it('re-checks everyone when the rules change, and keeps started activities', async () => {
    const app = await getTestApp();
    const headers = { authorization: `Bearer ${await adminToken()}` };
    const asha = await prisma.participant.findFirstOrThrow({
      where: { email: `asha-${run}@example.com` },
    });
    await prisma.attempt.create({
      data: {
        organizationId: ctx.organizationId,
        activityId: ctx.a,
        participantId: asha.id,
        startedAt: new Date(),
        deadlineAt: new Date(Date.now() + 3_600_000),
      },
    });
    const updated = await request(app, 'PATCH', `/api/contest-forms/${ctx.formId}`, {
      headers,
      body: {
        mode: 'save',
        fields,
        assignmentMode: 'rules',
        rules: [
          {
            id: 'r1',
            joins: [],
            conditions: [{ id: 'c1', fieldId: 'city', op: 'is', optionId: 'pune' }],
            activityIds: [ctx.b],
          },
        ],
        fallbackActivityIds: [ctx.c],
      },
    });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal(await statusFor(`asha-${run}@example.com`, ctx.b), 'assigned');
    // Started, so it stays even though the rule no longer gives it.
    assert.equal(await statusFor(`asha-${run}@example.com`, ctx.a), 'assigned');
    assert.equal(await statusFor(`bina-${run}@example.com`, ctx.c), 'assigned');

    // Moving Bina's fallback away takes it back: she never started it.
    const noFallback = await request(app, 'PATCH', `/api/contest-forms/${ctx.formId}`, {
      headers,
      body: { mode: 'save', fallbackActivityIds: [] },
    });
    assert.equal(noFallback.status, 200, JSON.stringify(noFallback.body));
    assert.equal(await statusFor(`bina-${run}@example.com`, ctx.c), 'unassigned');
  });

  it('blocks removing a field a rule uses', async () => {
    const app = await getTestApp();
    const headers = { authorization: `Bearer ${await adminToken()}` };
    const res = await request(app, 'PATCH', `/api/contest-forms/${ctx.formId}`, {
      headers,
      body: { mode: 'save', fields: fields.filter((field) => field.id !== 'city') },
    });
    assert.equal(res.status, 400);
    const error = (res.body as { error: { fields?: Record<string, string> } }).error;
    assert.match(Object.values(error.fields ?? {})[0] ?? '', /no longer on the form/);
  });

  it('checks the admin password before editing', async () => {
    const app = await getTestApp();
    const headers = { authorization: `Bearer ${await adminToken()}` };
    const wrong = await request(app, 'POST', '/api/contest-forms/confirm-password', {
      headers,
      body: { password: 'not-it' },
    });
    assert.equal(wrong.status, 401);
    const right = await request(app, 'POST', '/api/contest-forms/confirm-password', {
      headers,
      body: { password: 'Password123!' },
    });
    assert.equal(right.status, 200);
  });
});
