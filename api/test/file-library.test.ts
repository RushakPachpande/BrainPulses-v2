import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { prisma } from '../src/lib/prisma.js';
import { getTestApp, request } from './helpers.js';

const TAG = 'library-test';

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

async function studentToken() {
  const app = await getTestApp();
  const res = await request(app, 'POST', '/api/auth/student/sign-in-by-code', {
    body: { code: 'BP-24101', organizationSlug: 'nextgeninnov8', replaceSession: true },
  });
  return (res.body as { data: { accessToken: string } }).data.accessToken;
}

type LibraryRow = { id: string; originalName: string; storagePath?: string };

async function listNames(purpose: 'catalog' | 'question', token: string) {
  const app = await getTestApp();
  const res = await request(app, 'GET', `/api/files/images?purpose=${purpose}&q=${TAG}&limit=100`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 200);
  const rows = (res.body as { data: LibraryRow[] }).data;
  for (const row of rows) assert.equal(row.storagePath, undefined);
  return rows.map((row) => row.originalName).sort();
}

describe('image library', () => {
  before(async () => {
    const own = await prisma.organization.findUniqueOrThrow({ where: { slug: 'nextgeninnov8' } });
    const other = await prisma.organization.findUniqueOrThrow({ where: { slug: 'greycaps' } });
    const finalizedAt = new Date();
    const file = (organizationId: string, name: string, mimeType: string, sizeBytes = 1024) => ({
      organizationId,
      originalName: `${TAG}-${name}`,
      mimeType,
      sizeBytes,
      storagePath: `/nonexistent/${TAG}-${name}`,
      finalizedAt,
    });
    await prisma.fileObject.createMany({
      data: [
        file(own.id, 'logo.png', 'image/png'),
        file(own.id, 'anim.gif', 'image/gif'),
        file(own.id, 'huge.jpg', 'image/jpeg', 50 * 1024 * 1024),
        file(own.id, 'sheet.csv', 'text/csv'),
        { ...file(own.id, 'pending.png', 'image/png'), finalizedAt: null },
        file(other.id, 'other.png', 'image/png'),
      ],
    });
  });

  after(async () => {
    await prisma.fileObject.deleteMany({ where: { originalName: { startsWith: TAG } } });
  });

  it('lists only finalized images in the caller organization that fit the purpose', async () => {
    const token = await adminToken();
    assert.deepEqual(await listNames('catalog', token), [`${TAG}-logo.png`]);
    assert.deepEqual(await listNames('question', token), [`${TAG}-anim.gif`, `${TAG}-logo.png`]);
  });

  it('rejects unauthenticated callers, students, and a missing purpose', async () => {
    const app = await getTestApp();
    const anon = await request(app, 'GET', '/api/files/images?purpose=catalog');
    assert.equal(anon.status, 401);

    const student = await request(app, 'GET', '/api/files/images?purpose=catalog', {
      headers: { authorization: `Bearer ${await studentToken()}` },
    });
    assert.equal(student.status, 401);

    const missing = await request(app, 'GET', '/api/files/images', {
      headers: { authorization: `Bearer ${await adminToken()}` },
    });
    assert.equal(missing.status, 422);
  });
});
