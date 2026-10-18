import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { conflict } from './errors.js';
import { getRedis } from './redis.js';

const OTP_TTL_SECONDS = 600;
const MAX_ATTEMPTS = 5;
const COOLDOWN_SECONDS = 60;
const DAILY_SEND_LIMIT = 10;

type OtpRecord = {
  hash: string;
  studentId: string;
  organizationId: string;
};

function otpKey(organizationId: string, phone: string) {
  return `student-otp:${organizationId}:${phone}`;
}

function attemptsKey(organizationId: string, phone: string) {
  return `student-otp-attempts:${organizationId}:${phone}`;
}

function cooldownKey(organizationId: string, phone: string) {
  return `student-otp-cooldown:${organizationId}:${phone}`;
}

function dailyKey(organizationId: string, phone: string) {
  const day = new Date().toISOString().slice(0, 10);
  return `student-otp-daily:${organizationId}:${phone}:${day}`;
}

function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex');
}

export function generateOtpDigits(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export async function assertOtpSendAllowed(organizationId: string, phone: string): Promise<void> {
  const redis = getRedis();
  const cool = await redis.ttl(cooldownKey(organizationId, phone));
  if (cool > 0) {
    throw conflict(`Please wait ${cool}s before requesting another OTP.`, {
      reason: 'OTP_COOLDOWN',
      retryAfter: String(cool),
    });
  }
  const daily = Number((await redis.get(dailyKey(organizationId, phone))) ?? '0');
  if (daily >= DAILY_SEND_LIMIT) {
    throw conflict('Daily OTP send limit reached. Try again tomorrow.', {
      reason: 'OTP_DAILY_LIMIT',
    });
  }
}

export async function markOtpSend(organizationId: string, phone: string): Promise<void> {
  const redis = getRedis();
  const daily = dailyKey(organizationId, phone);
  await redis
    .multi()
    .set(cooldownKey(organizationId, phone), '1', 'EX', COOLDOWN_SECONDS)
    .incr(daily)
    .expire(daily, 86_400)
    .exec();
}

/** Store a new OTP hash. Failed-attempt counter is preserved across reissues. */
export async function storeStudentOtp(input: {
  organizationId: string;
  phone: string;
  studentId: string;
  otp: string;
}): Promise<void> {
  const redis = getRedis();
  const record: OtpRecord = {
    hash: hashOtp(input.otp),
    studentId: input.studentId,
    organizationId: input.organizationId,
  };
  const key = otpKey(input.organizationId, input.phone);
  const aKey = attemptsKey(input.organizationId, input.phone);
  await redis.set(key, JSON.stringify(record), 'EX', OTP_TTL_SECONDS);
  // Keep existing attempts if present; only set TTL if the key already exists or create at 0.
  const existing = await redis.get(aKey);
  if (existing === null) {
    await redis.set(aKey, '0', 'EX', OTP_TTL_SECONDS);
  } else {
    await redis.expire(aKey, OTP_TTL_SECONDS);
  }
}

export async function consumeStudentOtp(organizationId: string, phone: string): Promise<boolean> {
  const redis = getRedis();
  const key = otpKey(organizationId, phone);
  const aKey = attemptsKey(organizationId, phone);
  const raw = await redis.getdel(key);
  if (raw) {
    await redis.del(aKey);
    return true;
  }
  return false;
}

export async function verifyStudentOtp(input: {
  organizationId: string;
  phone: string;
  otp: string;
  /** When false, validate without consuming (for session-conflict checks). Default true. */
  consume?: boolean;
}): Promise<
  { ok: true; studentId: string } | { ok: false; reason: 'missing' | 'invalid' | 'exhausted' }
> {
  const redis = getRedis();
  const key = otpKey(input.organizationId, input.phone);
  const aKey = attemptsKey(input.organizationId, input.phone);
  const consume = input.consume !== false;

  const attempts = await redis.incr(aKey);
  if (attempts === 1) {
    await redis.expire(aKey, OTP_TTL_SECONDS);
  }
  if (attempts > MAX_ATTEMPTS) {
    await redis.del(key, aKey);
    return { ok: false, reason: 'exhausted' };
  }

  const raw = await redis.get(key);
  if (!raw) {
    await redis.del(aKey);
    return { ok: false, reason: 'missing' };
  }

  let record: OtpRecord;
  try {
    record = JSON.parse(raw) as OtpRecord;
  } catch {
    await redis.del(key, aKey);
    return { ok: false, reason: 'missing' };
  }

  const expected = Buffer.from(record.hash, 'utf8');
  const actual = Buffer.from(hashOtp(input.otp), 'utf8');
  const match = expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!match) {
    if (attempts >= MAX_ATTEMPTS) {
      await redis.del(key, aKey);
      return { ok: false, reason: 'exhausted' };
    }
    return { ok: false, reason: 'invalid' };
  }

  // Successful match: undo the attempt increment used for this check.
  await redis.decr(aKey);

  if (consume) {
    const deleted = await redis.getdel(key);
    if (!deleted) {
      return { ok: false, reason: 'missing' };
    }
    await redis.del(aKey);
  }

  return { ok: true, studentId: record.studentId };
}

export async function clearStudentOtp(organizationId: string, phone: string): Promise<void> {
  const redis = getRedis();
  await redis.del(otpKey(organizationId, phone), attemptsKey(organizationId, phone));
}
