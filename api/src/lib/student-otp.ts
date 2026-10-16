import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { getRedis } from './redis.js';

const OTP_TTL_SECONDS = 600;
const MAX_ATTEMPTS = 5;

type OtpRecord = {
  hash: string;
  attempts: number;
  studentId: string;
  organizationId: string;
};

function otpKey(organizationId: string, phone: string) {
  return `student-otp:${organizationId}:${phone}`;
}

function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex');
}

export function generateOtpDigits(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export async function storeStudentOtp(input: {
  organizationId: string;
  phone: string;
  studentId: string;
  otp: string;
}): Promise<void> {
  const redis = getRedis();
  const record: OtpRecord = {
    hash: hashOtp(input.otp),
    attempts: 0,
    studentId: input.studentId,
    organizationId: input.organizationId,
  };
  await redis.set(otpKey(input.organizationId, input.phone), JSON.stringify(record), 'EX', OTP_TTL_SECONDS);
}

export async function verifyStudentOtp(input: {
  organizationId: string;
  phone: string;
  otp: string;
}): Promise<{ ok: true; studentId: string } | { ok: false; reason: 'missing' | 'invalid' | 'exhausted' }> {
  const redis = getRedis();
  const key = otpKey(input.organizationId, input.phone);
  const raw = await redis.get(key);
  if (!raw) return { ok: false, reason: 'missing' };

  let record: OtpRecord;
  try {
    record = JSON.parse(raw) as OtpRecord;
  } catch {
    await redis.del(key);
    return { ok: false, reason: 'missing' };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await redis.del(key);
    return { ok: false, reason: 'exhausted' };
  }

  const expected = Buffer.from(record.hash, 'utf8');
  const actual = Buffer.from(hashOtp(input.otp), 'utf8');
  const match =
    expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!match) {
    record.attempts += 1;
    const ttl = await redis.ttl(key);
    if (record.attempts >= MAX_ATTEMPTS) {
      await redis.del(key);
      return { ok: false, reason: 'exhausted' };
    }
    await redis.set(key, JSON.stringify(record), 'EX', ttl > 0 ? ttl : OTP_TTL_SECONDS);
    return { ok: false, reason: 'invalid' };
  }

  await redis.del(key);
  return { ok: true, studentId: record.studentId };
}

export async function clearStudentOtp(organizationId: string, phone: string): Promise<void> {
  await getRedis().del(otpKey(organizationId, phone));
}
