import { env } from '../config/env.js';

/** Phone sign-in stays archived until Twilio is switched on and all three credentials are set. */
export function isTwilioConfigured(): boolean {
  return Boolean(
    env.TWILIO_ENABLED && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER,
  );
}

export async function sendSmsOtp(toPhone: string, otp: string): Promise<void> {
  if (!isTwilioConfigured()) {
    if (env.NODE_ENV !== 'production') {
      console.info(`[otp] TWILIO_ENABLED=false — OTP for ${toPhone}: ${otp}`);
    }
    return;
  }

  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  const fromNumber = env.TWILIO_FROM_NUMBER;
  if (!accountSid || !authToken || !fromNumber) return;

  const twilio = await import('twilio');
  const client = twilio.default(accountSid, authToken);
  await client.messages.create({
    body: `Your BrainPulses verification code is ${otp}`,
    from: fromNumber,
    to: toPhone,
  });
}
