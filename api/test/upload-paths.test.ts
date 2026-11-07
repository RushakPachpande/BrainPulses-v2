import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import {
  assignOwners,
  destinationKey,
  moveUploadFile,
  pendingRelative,
  recordSlug,
  relocationTarget,
  storageRelativeForInitiate,
  type ImageDestination,
} from '../src/modules/files/paths.js';

const ORG = 'c049f0e3-38f7-4620-b9f6-63fb13abed23';
const FILE = '7473297e-55a1-4dcc-bacc-8b1b014c601c.jpg';
const roots: string[] = [];

after(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

async function tempRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bp-uploads-'));
  roots.push(root);
  return root;
}

describe('upload paths', () => {
  it('builds a readable slug from the record name and a short id', () => {
    assert.equal(
      recordSlug('Grade 5 Midterm Assessment', '0ee6aaaa-1111-4222-8333-444444444444'),
      'grade-5-midterm-assessment-0ee6',
    );
  });

  it('puts image initiates in the organization pending folder', () => {
    assert.equal(storageRelativeForInitiate(ORG, FILE, 'question'), `${ORG}/pending/${FILE}`);
    assert.equal(pendingRelative(ORG, FILE), `${ORG}/pending/${FILE}`);
    assert.equal(storageRelativeForInitiate(ORG, FILE, 'catalog'), `${ORG}/pending/${FILE}`);
    assert.equal(storageRelativeForInitiate(ORG, 'notes.pdf'), `${ORG}/notes.pdf`);
  });

  it('moves a single-owner file out of the flat organization folder', async () => {
    const root = await tempRoot();
    const legacy = path.join(root, ORG, FILE);
    await mkdir(path.dirname(legacy), { recursive: true });
    await writeFile(legacy, 'img');
    const dest: ImageDestination = {
      kind: 'sponsor',
      sponsorName: 'NextGen',
      sponsorId: '649913fb-41ee-4ffa-af84-029fbbb5c282',
    };
    const decisions = assignOwners([{ fileId: FILE, ownerKey: destinationKey(dest), dest }]);
    const target = relocationTarget(decisions.get(FILE));
    assert.ok(target);
    const moved = await moveUploadFile(root, legacy, ORG, target);
    assert.equal(moved.status, 'moved');
    assert.equal(await readFile(moved.storagePath, 'utf8'), 'img');
    assert.equal(
      path.relative(root, moved.storagePath).split(path.sep).join('/'),
      `${ORG}/sponsors/nextgen-6499/${FILE}`,
    );
    const again = await moveUploadFile(root, moved.storagePath, ORG, target);
    assert.equal(again.status, 'left');
  });

  it('leaves a file in place when two owners claim it', async () => {
    const root = await tempRoot();
    const legacy = path.join(root, ORG, FILE);
    await mkdir(path.dirname(legacy), { recursive: true });
    await writeFile(legacy, 'shared');
    const sponsor: ImageDestination = {
      kind: 'sponsor',
      sponsorName: 'NextGen',
      sponsorId: '649913fb-41ee-4ffa-af84-029fbbb5c282',
    };
    const bank: ImageDestination = {
      kind: 'reusable-bank',
      bankKind: 'assessment',
      bankName: 'English',
      bankId: '2a4ddc6d-2dba-4cb8-af6b-17f2df0ca7f9',
    };
    const fileId = '2a4ddc6d-2dba-4cb8-af6b-17f2df0ca7f9';
    const decisions = assignOwners([
      { fileId, ownerKey: destinationKey(sponsor), dest: sponsor },
      { fileId, ownerKey: destinationKey(bank), dest: bank },
    ]);
    assert.equal(relocationTarget(decisions.get(fileId)), null);
    assert.equal(await readFile(legacy, 'utf8'), 'shared');
  });
});
