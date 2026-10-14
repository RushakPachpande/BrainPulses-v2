import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import { env } from '../../config/env.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { getRedis } from '../../lib/redis.js';

async function ensureUploadDir(organizationId: string) {
  const dir = path.resolve(env.UPLOAD_DIR, organizationId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function initiateUpload(
  organizationId: string,
  userId: string,
  input: { originalName: string; mimeType: string; sizeBytes: number },
) {
  if (input.sizeBytes <= 0 || input.sizeBytes > 20 * 1024 * 1024) {
    throw badRequest('File size must be between 1 byte and 20MB.');
  }

  const dir = await ensureUploadDir(organizationId);
  const storageName = `${randomUUID()}${path.extname(input.originalName)}`;
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

  await pipeline(stream, createWriteStream(file.storagePath));

  const updated = await prisma.fileObject.update({
    where: { id: fileId },
    data: { finalizedAt: new Date() },
  });

  return {
    id: updated.id,
    originalName: updated.originalName,
    mimeType: updated.mimeType,
    sizeBytes: updated.sizeBytes,
    finalizedAt: updated.finalizedAt,
  };
}

export async function createDownloadToken(organizationId: string, userId: string, fileId: string) {
  const file = await prisma.fileObject.findFirst({
    where: { organizationId, id: fileId, finalizedAt: { not: null } },
  });
  if (!file) throw notFound('File not found.');

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
