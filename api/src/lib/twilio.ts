import { env } from '../config/env.js';

export async function sendSmsOtp(toPhone: string, otp: string): Promise<void> {
  if (!env.TWILIO_ENABLED) {
    if (env.NODE_ENV !== 'production') {
      console.info(`[otp] TWILIO_ENABLED=false — OTP for ${toPhone}: ${otp}`);
    }
    return;
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    throw new Error('Twilio is enabled but credentials are incomplete.');
  }

  const twilio = await import('twilio');
  const client = twilio.default(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  await client.messages.create({
    body: `Your BrainPulses verification code is ${otp}`,
    from: TWILIO_FROM_NUMBER,
    to: toPhone,
  });
}

/** Dev/test number that always uses a fixed OTP when Twilio is disabled. */
export const DEV_FIXED_OTP_PHONE = '+919008001140';
export const DEV_FIXED_OTP = '000000';
