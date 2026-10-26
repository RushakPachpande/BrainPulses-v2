import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform, type Readable } from 'node:stream';
import { env } from '../../config/env.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { getRedis } from '../../lib/redis.js';
import type { AccessLevel, MembershipRole } from '#prisma';

const ALLOWED_UPLOADS: { mime: string; exts: string[] }[] = [
  { mime: 'image/png', exts: ['.png'] },
  { mime: 'image/jpeg', exts: ['.jpg', '.jpeg'] },
  { mime: 'image/webp', exts: ['.webp'] },
  { mime: 'image/gif', exts: ['.gif'] },
  { mime: 'application/pdf', exts: ['.pdf'] },
  { mime: 'text/csv', exts: ['.csv'] },
  { mime: 'text/plain', exts: ['.txt', '.csv'] },
  {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    exts: ['.xlsx'],
  },
];

const BLOCKED_EXTS = new Set([
  '.html',
  '.htm',
  '.js',
  '.mjs',
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.php',
  '.svg',
]);

const accessRank: Record<AccessLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
  full: 3,
};

function assertAllowedFile(originalName: string, mimeType: string) {
  const ext = path.extname(originalName).toLowerCase();
  if (!ext || BLOCKED_EXTS.has(ext)) {
    throw badRequest('File extension is not allowed.');
  }
  const match = ALLOWED_UPLOADS.find((a) => a.mime === mimeType && a.exts.includes(ext));
  if (!match) {
    throw badRequest('MIME type or extension is not allowed.');
  }
}

async function ensureUploadDir(organizationId: string) {
  const dir = path.resolve(env.UPLOAD_DIR, organizationId);
  await mkdir(dir, { recursive: true });
  return dir;
}

function byteLimitTransform(maxBytes: number) {
  let total = 0;
  return new Transform({
    transform(chunk, _enc, cb) {
      total += chunk.length;
      if (total > maxBytes) {
        cb(badRequest('Upload exceeds declared size.'));
        return;
      }
      cb(null, chunk);
    },
  });
}

export async function initiateUpload(
  organizationId: string,
  userId: string,
  input: {
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    purpose?: 'catalog' | 'question';
  },
) {
  const maxBytes = maxUploadBytes(input.mimeType, input.purpose);
  if (input.sizeBytes <= 0 || input.sizeBytes > maxBytes) {
    throw badRequest(`File size must be between 1 byte and ${formatMegabytes(maxBytes)}.`);
  }
  assertAllowedFile(input.originalName, input.mimeType);

  const dir = await ensureUploadDir(organizationId);
  const storageName = `${randomUUID()}${path.extname(input.originalName).toLowerCase()}`;
  const storagePath = path.join(dir, storageName);

  const file = await prisma.fileObject.create({
    data: {
      organizationId,
      uploadedById: userId,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storagePath,
    },
  });

  return {
    id: file.id,
    uploadPath: `/api/files/${file.id}/content`,
  };
}

export async function finalizeUpload(
  organizationId: string,
  userId: string,
  fileId: string,
  stream: Readable,
) {
  const file = await prisma.fileObject.findFirst({
    where: { organizationId, id: fileId, uploadedById: userId },
  });
  if (!file) throw notFound('File not found.');
  if (file.finalizedAt) throw badRequest('File already finalized.');

  try {
    await pipeline(stream, byteLimitTransform(file.sizeBytes), createWriteStream(file.storagePath));
  } catch (err) {
    try {
      await unlink(file.storagePath);
    } catch {
      // ignore
    }
    throw err;
  }

  const info = await stat(file.storagePath);
  if (info.size > file.sizeBytes) {
    await unlink(file.storagePath).catch(() => undefined);
    throw badRequest('Upload exceeds declared size.');
  }

  const updated = await prisma.fileObject.update({
    where: { id: fileId },
    data: { finalizedAt: new Date(), sizeBytes: info.size },
  });

  return {
    id: updated.id,
    originalName: updated.originalName,
    mimeType: updated.mimeType,
    sizeBytes: updated.sizeBytes,
    finalizedAt: updated.finalizedAt,
  };
}

export async function createDownloadToken(
  organizationId: string,
  userId: string,
  fileId: string,
  actor: {
    role: MembershipRole;
    assessmentAccess: AccessLevel;
    quizAccess: AccessLevel;
  },
) {
  const file = await prisma.fileObject.findFirst({
    where: { organizationId, id: fileId, finalizedAt: { not: null } },
  });
  if (!file) throw notFound('File not found.');

  const isUploader = file.uploadedById === userId;
  const maxAccess = Math.max(accessRank[actor.assessmentAccess], accessRank[actor.quizAccess]);
  const canEdit = actor.role === 'super_admin' || maxAccess >= accessRank.edit;
  if (!isUploader && !canEdit) {
    throw forbidden('Insufficient access to download this file.');
  }

  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  await getRedis().set(
    `file:dl:${hash}`,
    JSON.stringify({ fileId, organizationId, userId }),
    'EX',
    env.FILE_DOWNLOAD_TTL_SECONDS,
  );

  return {
    token,
    expiresIn: env.FILE_DOWNLOAD_TTL_SECONDS,
    // Query token retained for SPA simplicity; residual Referer risk documented in THREAT_MODEL.
    downloadPath: `/api/files/download?token=${token}`,
  };
}

export async function downloadWithToken(token: string) {
  const hash = createHash('sha256').update(token).digest('hex');
  const raw = await getRedis().get(`file:dl:${hash}`);
  if (!raw) throw forbidden('Download token is invalid or expired.');

  const payload = JSON.parse(raw) as {
    fileId: string;
    organizationId: string;
  };

  const file = await prisma.fileObject.findFirst({
    where: {
      id: payload.fileId,
      organizationId: payload.organizationId,
      finalizedAt: { not: null },
    },
  });
  if (!file) throw notFound('File not found.');

  const buffer = await readFile(file.storagePath);
  return { file, buffer };
}

const FILE_MAX_BYTES = 20 * 1024 * 1024;
const CATALOG_IMAGE_MAX_BYTES = env.UPLOAD_IMAGE_SIZE_CAPPING || 10 * 1024 * 1024;
const QUESTION_IMAGE_MAX_BYTES = env.QA_UPLOAD_IMAGE_SIZE_CAPPING || 5 * 1024 * 1024;

function formatMegabytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)}MB`;
}

function maxUploadBytes(mimeType: string, purpose?: 'catalog' | 'question') {
  if (!mimeType.startsWith('image/')) return FILE_MAX_BYTES;
  return purpose === 'question' ? QUESTION_IMAGE_MAX_BYTES : CATALOG_IMAGE_MAX_BYTES;
}

const SPONSOR_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export async function assertCatalogImage(organizationId: string, fileId: string) {
  const file = await prisma.fileObject.findFirst({
    where: { organizationId, id: fileId, finalizedAt: { not: null } },
  });
  if (!file) throw badRequest('Upload an image before saving.');
  if (!SPONSOR_IMAGE_MIMES.has(file.mimeType)) {
    throw badRequest('Image must be PNG, JPEG, or WebP.');
  }
  if (file.sizeBytes <= 0 || file.sizeBytes > CATALOG_IMAGE_MAX_BYTES) {
    throw badRequest(`Image must be ${formatMegabytes(CATALOG_IMAGE_MAX_BYTES)} or smaller.`);
  }
  return file;
}

export async function readInlineImage(organizationId: string, fileId: string) {
  const file = await prisma.fileObject.findFirst({
    where: { organizationId, id: fileId, finalizedAt: { not: null } },
  });
  if (!file) throw notFound('File not found.');
  if (!file.mimeType.startsWith('image/')) {
    throw badRequest('Only images can be shown inline.');
  }
  const buffer = await readFile(file.storagePath);
  return { file, buffer };
}

export async function deletePendingFile(organizationId: string, fileId: string) {
  const file = await prisma.fileObject.findFirst({
    where: { organizationId, id: fileId, finalizedAt: null },
  });
  if (!file) return;
  try {
    await unlink(file.storagePath);
  } catch {
    // ignore missing file
  }
  await prisma.fileObject.delete({ where: { id: fileId } });
}
