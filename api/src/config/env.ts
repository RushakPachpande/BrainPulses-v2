import './load-env.js';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default(process.env.NODE_ENV === 'test' ? 'test' : 'development'),
    HOST: z.string().default('0.0.0.0'),

    PORT: z.coerce.number().default(3002),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    JWT_SECRET: z.string().min(16),
    JWT_ISSUER: z.string().min(1).default('brainpulses-api'),
    JWT_AUDIENCE: z.string().min(1).default('brainpulses-admin'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_ORG_SELECT_EXPIRES_IN: z.string().default('5m'),
    REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().default(604_800),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    COOKIE_SECURE: z
      .string()
      .optional()
      .transform((v) => v === 'true'),
    COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    UPLOAD_DIR: z.string().default('./uploads'),
    FILE_DOWNLOAD_TTL_SECONDS: z.coerce.number().default(300),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().default(120),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().default(20),
    /** Trusted proxy hop count. 0 = direct connections (default). */
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    DASHBOARD_CACHE_TTL_SECONDS: z.coerce.number().default(60),
    TWILIO_ENABLED: z
      .string()
      .optional()
      .transform((v) => v === 'true'),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_FROM_NUMBER: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== 'production') return;
    if (data.JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be at least 32 characters in production.',
      });
    }
    if (!data.COOKIE_SECURE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['COOKIE_SECURE'],
        message: 'COOKIE_SECURE must be true in production.',
      });
    }
    if (!data.TWILIO_ENABLED) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TWILIO_ENABLED'],
        message: 'TWILIO_ENABLED must be true in production.',
      });
    }
    for (const key of ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'] as const) {
      if (!data[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required in production.`,
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
