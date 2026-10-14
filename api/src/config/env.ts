import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default(process.env.NODE_ENV === 'test' ? 'test' : 'development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().default(3002),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
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
  DASHBOARD_CACHE_TTL_SECONDS: z.coerce.number().default(60),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
