import { mkdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';

export function sanitizeSegment(value: string, fallback = 'item'): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/\.\./g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || fallback;
}

/** Lowercase name plus the first four hex characters of the id. */
export function recordSlug(name: string, id: string): string {
  const short = id.replace(/-/g, '').slice(0, 4);
  return `${sanitizeSegment(name, 'item')}-${short}`;
}

export function kindFolder(kind: 'assessment' | 'quiz'): 'assessments' | 'quizzes' {
  return kind === 'quiz' ? 'quizzes' : 'assessments';
}

export type ImageDestination =
  | { kind: 'sponsor'; sponsorName: string; sponsorId: string }
  | {
      kind: 'contest';
      sponsorName: string;
      sponsorId: string;
      contestName: string;
      contestId: string;
    }
  | {
      kind: 'activity';
      activityKind: 'assessment' | 'quiz';
      activityName: string;
      activityId: string;
    }
  | {
      kind: 'round';
      activityName: string;
      activityId: string;
      roundName: string;
      roundId: string;
    }
  | {
      kind: 'reusable-bank';
      bankKind: 'assessment' | 'quiz';
      bankName: string;
      bankId: string;
    }
  | {
      kind: 'round-questions';
      activityName: string;
      activityId: string;
      roundName: string;
      roundId: string;
    }
  | { kind: 'quiz-questions'; activityName: string; activityId: string };

export function destinationSegments(dest: ImageDestination): string[] {
  switch (dest.kind) {
    case 'sponsor':
      return ['sponsors', recordSlug(dest.sponsorName, dest.sponsorId)];
    case 'contest':
      return [
        'sponsors',
        recordSlug(dest.sponsorName, dest.sponsorId),
        'contests',
        recordSlug(dest.contestName, dest.contestId),
      ];
    case 'activity':
      return [
        'activities',
        kindFolder(dest.activityKind),
        recordSlug(dest.activityName, dest.activityId),
      ];
    case 'round':
      return [
        'activities',
        'assessments',
        recordSlug(dest.activityName, dest.activityId),
        'rounds',
        recordSlug(dest.roundName, dest.roundId),
      ];
    case 'reusable-bank':
      return ['questions', kindFolder(dest.bankKind), recordSlug(dest.bankName, dest.bankId)];
    case 'round-questions':
      return [
        'activities',
        'assessments',
        recordSlug(dest.activityName, dest.activityId),
        'rounds',
        recordSlug(dest.roundName, dest.roundId),
        'questions',
      ];
    case 'quiz-questions':
      return ['activities', 'quizzes', recordSlug(dest.activityName, dest.activityId), 'questions'];
    default: {
      const _exhaustive: never = dest;
      return _exhaustive;
    }
  }
}

export function destinationKey(dest: ImageDestination): string {
  return destinationSegments(dest).join('/');
}

export function safeFileName(fileName: string): string {
  const name = path.basename(fileName);
  if (!name || name === '.' || name === '..' || !/^[a-zA-Z0-9._-]+$/.test(name)) {
    throw new Error('Invalid storage file name');
  }
  return name;
}

export function relativeUploadKey(
  organizationId: string,
  segments: string[],
  fileName: string,
): string {
  const org = sanitizeSegment(organizationId, 'org');
  const parts = segments.map((segment) => sanitizeSegment(segment, 'x'));
  return [org, ...parts, safeFileName(fileName)].join('/');
}

export function pendingRelative(organizationId: string, fileName: string): string {
  return relativeUploadKey(organizationId, ['pending'], fileName);
}

export function storageRelativeForInitiate(
  organizationId: string,
  fileName: string,
  purpose?: 'catalog' | 'question',
): string {
  if (purpose === 'catalog' || purpose === 'question') {
    return pendingRelative(organizationId, fileName);
  }
  return relativeUploadKey(organizationId, [], fileName);
}

export function destinationRelative(
  organizationId: string,
  fileName: string,
  dest: ImageDestination,
): string {
  return relativeUploadKey(organizationId, destinationSegments(dest), fileName);
}

export function resolveUnderRoot(root: string, relativeKey: string): string {
  const base = path.resolve(root);
  const resolved = path.resolve(base, ...relativeKey.split('/').filter(Boolean));
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error('Invalid storage path');
  }
  return resolved;
}

export function relativeFromRoot(root: string, absolutePath: string): string | null {
  const base = path.resolve(root);
  const resolved = path.resolve(absolutePath);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null;
  const relative = path.relative(base, resolved);
  if (!relative || relative.startsWith('..')) return null;
  return relative.split(path.sep).join('/');
}

/** Pending uploads and the old flat `{org}/{file}` layout can still move. */
export function isRelocatableKey(relativeKey: string, organizationId: string): boolean {
  const org = sanitizeSegment(organizationId, 'org');
  const parts = relativeKey.split('/').filter(Boolean);
  if (parts.length < 2 || parts[0] !== org) return false;
  if (parts.some((part) => part === '.' || part === '..')) return false;
  if (parts.length === 3 && parts[1] === 'pending') return true;
  return parts.length === 2;
}

const FILE_URL = /\/api\/files\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;

export function fileIdsInText(value: string | null | undefined): string[] {
  if (!value) return [];
  const ids: string[] = [];
  for (const match of value.matchAll(FILE_URL)) {
    const id = match[1];
    if (id) ids.push(id.toLowerCase());
  }
  return ids;
}

export function fileIdsInAnswerKey(answerKey: unknown): string[] {
  if (!answerKey || typeof answerKey !== 'object' || Array.isArray(answerKey)) return [];
  const key = answerKey as Record<string, unknown>;
  const ids: string[] = [];
  for (const field of ['questionImageUrl', 'stemImageUrl']) {
    const value = key[field];
    if (typeof value === 'string') ids.push(...fileIdsInText(value));
  }
  return ids;
}

export type OwnerClaim<T> = { fileId: string; ownerKey: string; dest: T };

/** One destination when every claim shares an owner key. Otherwise ambiguous. */
export function assignOwners<T>(claims: OwnerClaim<T>[]): Map<string, T | 'ambiguous'> {
  const grouped = new Map<string, { ownerKey: string; dest: T } | 'ambiguous'>();
  for (const claim of claims) {
    const id = claim.fileId.toLowerCase();
    const existing = grouped.get(id);
    if (!existing) {
      grouped.set(id, { ownerKey: claim.ownerKey, dest: claim.dest });
      continue;
    }
    if (existing === 'ambiguous') continue;
    if (existing.ownerKey !== claim.ownerKey) grouped.set(id, 'ambiguous');
  }
  const decisions = new Map<string, T | 'ambiguous'>();
  for (const [id, value] of grouped) {
    decisions.set(id, value === 'ambiguous' ? 'ambiguous' : value.dest);
  }
  return decisions;
}

export function relocationTarget<T>(decision: T | 'ambiguous' | undefined): T | null {
  if (decision === undefined || decision === 'ambiguous') return null;
  return decision;
}

export async function moveUploadFile(
  root: string,
  currentAbsolute: string,
  organizationId: string,
  dest: ImageDestination,
): Promise<{ status: 'moved' | 'left' | 'missing'; storagePath: string }> {
  const relative = relativeFromRoot(root, currentAbsolute);
  if (!relative || !isRelocatableKey(relative, organizationId)) {
    return { status: 'left', storagePath: path.resolve(currentAbsolute) };
  }
  const fileName = relative.split('/').pop();
  if (!fileName) return { status: 'left', storagePath: path.resolve(currentAbsolute) };
  const nextRelative = destinationRelative(organizationId, fileName, dest);
  if (nextRelative === relative) {
    return { status: 'left', storagePath: resolveUnderRoot(root, relative) };
  }
  const currentPath = resolveUnderRoot(root, relative);
  const nextPath = resolveUnderRoot(root, nextRelative);
  try {
    await stat(currentPath);
  } catch {
    return { status: 'missing', storagePath: currentPath };
  }
  await mkdir(path.dirname(nextPath), { recursive: true });
  await rename(currentPath, nextPath);
  return { status: 'moved', storagePath: nextPath };
}
