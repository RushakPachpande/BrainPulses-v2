import { parseByteSize } from '@/lib/byte-size';

const MB = 1024 * 1024;

function bytesFromEnv(raw: string | undefined, fallback: number) {
  if (raw === undefined || raw.trim() === '') return fallback;
  return parseByteSize(raw) || fallback;
}

/** Catalog and other images. Unset env uses 10MB. */
export const UPLOAD_IMAGE_SIZE_CAPPING = bytesFromEnv(
  import.meta.env.UPLOAD_IMAGE_SIZE_CAPPING,
  10 * MB,
);

/** Question and answer images. Unset env uses 5MB. */
export const QA_UPLOAD_IMAGE_SIZE_CAPPING = bytesFromEnv(
  import.meta.env.QA_UPLOAD_IMAGE_SIZE_CAPPING,
  5 * MB,
);

export function formatUploadMegabytes(bytes: number) {
  const mb = bytes / MB;
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)}MB`;
}
