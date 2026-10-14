import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { RedisStore } from 'rate-limit-redis';
import { env } from './config/env.js';
import { getRedis, isRedisReady } from './lib/redis.js';
import { prisma } from './lib/prisma.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestId } from './middleware/request-id.js';
import { activitiesRouter } from './modules/activities/routes.js';
import { attemptsRouter } from './modules/attempts/routes.js';
import { auditRouter } from './modules/audit/routes.js';
import { authRouter } from './modules/auth/routes.js';
import { banksRouter } from './modules/banks/routes.js';
import { dashboardRouter } from './modules/dashboard/routes.js';
import { filesRouter } from './modules/files/routes.js';
import { registrationsRouter } from './modules/registrations/routes.js';
import { resultsRouter } from './modules/results/routes.js';
import { settingsRouter } from './modules/settings/routes.js';
import { studentsRouter } from './modules/students/routes.js';
import { usersRouter } from './modules/users/routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(requestId);
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      credentials: true,
      exposedHeaders: ['Content-Disposition', 'x-request-id'],
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));

  const limiterOptions = {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    standardHeaders: true as const,
    legacyHeaders: false as const,
  };

  function redisStore() {
    return new RedisStore({
      prefix: 'rl:bp:',
      sendCommand: async (...args: string[]) => {
        const [command, ...rest] = args;
        // ioredis call typing is loose across versions
        return await (
          getRedis() as unknown as {
            call: (
              ...a: string[]
            ) => Promise<string | number | boolean | (string | number | boolean)[]>;
          }
        ).call(command!, ...rest);
      },
    });
  }

  const skipInTest = env.NODE_ENV === 'test' ? () => true : undefined;

  const apiLimiter = rateLimit({
    ...limiterOptions,
    max: env.RATE_LIMIT_MAX,
    skip: (req) => Boolean(skipInTest?.()) || req.originalUrl.startsWith('/api/auth'),
    validate: { xForwardedForHeader: false },
    ...(isRedisReady() ? { store: redisStore() } : {}),
  });

  const authLimiter = rateLimit({
    ...limiterOptions,
    max: env.AUTH_RATE_LIMIT_MAX,
    skip: skipInTest,
    validate: { xForwardedForHeader: false },
    ...(isRedisReady() ? { store: redisStore() } : {}),
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'brainpulses-api', time: new Date().toISOString() });
  });

  app.get('/health/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      if (!isRedisReady()) {
        res.status(503).json({ ok: false, postgres: true, redis: false });
        return;
      }
      await getRedis().ping();
      res.json({ ok: true, postgres: true, redis: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.use('/api', apiLimiter);
  app.use('/api/auth', authLimiter, authRouter);
  app.use('/api/students', studentsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/activities', activitiesRouter);
  app.use('/api/banks', banksRouter);
  app.use('/api/registrations', registrationsRouter);
  app.use('/api/attempts', attemptsRouter);
  app.use('/api/results', resultsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/files', filesRouter);

  app.use(errorHandler);
  return app;
}
