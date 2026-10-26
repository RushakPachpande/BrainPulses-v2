import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { RedisStore } from 'rate-limit-redis';
import { env } from './config/env.js';
import { createCorsOriginDelegate } from './lib/cors-origin.js';
import { getRedis, isRedisReady } from './lib/redis.js';
import { prisma } from './lib/prisma.js';

import { errorHandler } from './middleware/error-handler.js';
import { requestId } from './middleware/request-id.js';
import { requestTimeout } from './middleware/request-timeout.js';
import { activitiesRouter } from './modules/activities/routes.js';
import { adminAttemptsRouter } from './modules/attempts/admin-routes.js';
import { attemptsRouter } from './modules/attempts/routes.js';
import { leaderboardsRouter, studentLeaderboardsRouter } from './modules/leaderboards/routes.js';
import { auditRouter } from './modules/audit/routes.js';
import { authRouter } from './modules/auth/routes.js';
import { banksRouter } from './modules/banks/routes.js';
import { dashboardRouter } from './modules/dashboard/routes.js';
import { contestsRouter } from './modules/contests/routes.js';
import { filesRouter } from './modules/files/routes.js';
import { sponsorsRouter } from './modules/sponsors/routes.js';
import { registrationsRouter } from './modules/registrations/routes.js';
import { resultsRouter } from './modules/results/routes.js';
import { settingsRouter } from './modules/settings/routes.js';
import { studentPortalRouter } from './modules/student-portal/routes.js';
import { studentsRouter } from './modules/students/routes.js';
import { usersRouter } from './modules/users/routes.js';

export function createApp() {
  const app = express();

  if (env.NODE_ENV === 'production' && !isRedisReady()) {
    throw new Error('Redis must be ready in production for rate limits and refresh tokens.');
  }

  app.set('trust proxy', env.TRUST_PROXY);
  app.use(requestId);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin: createCorsOriginDelegate(env.CORS_ORIGIN, env.NODE_ENV),
      credentials: true,
      exposedHeaders: ['Content-Disposition', 'x-request-id', 'Retry-After'],
    }),
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));

  const limiterOptions = {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    standardHeaders: true as const,
    legacyHeaders: false as const,
    handler: (
      req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
      options: {
        statusCode: number;
        message: string | object;
        windowMs: number;
      },
    ) => {
      res.setHeader('Retry-After', String(Math.ceil(options.windowMs / 1000)));
      res.status(options.statusCode).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Try again later.',
          requestId: req.requestId,
        },
      });
    },
  };

  function redisStore(prefix: string) {
    return new RedisStore({
      prefix,
      sendCommand: async (...args: string[]) => {
        const [command, ...rest] = args;
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

  const skipInTest =
    env.NODE_ENV === 'test' && process.env.ENABLE_RATE_LIMIT_IN_TEST !== 'true'
      ? () => true
      : undefined;
  const useRedisStore = isRedisReady();

  const apiLimiter = rateLimit({
    ...limiterOptions,
    max: env.RATE_LIMIT_MAX,
    skip: (req) => Boolean(skipInTest?.()) || req.originalUrl.startsWith('/api/auth'),
    validate: { xForwardedForHeader: true },
    ...(useRedisStore ? { store: redisStore('rl:bp:api:') } : {}),
  });

  const authLimiter = rateLimit({
    ...limiterOptions,
    max: env.AUTH_RATE_LIMIT_MAX,
    // Brute-force budget applies to sign-in; refresh/sign-out are session hygiene on every boot.
    skip: (req) => {
      if (skipInTest?.()) return true;
      const path = (req.originalUrl.split('?')[0] ?? '').replace(/\/$/, '');
      return path === '/api/auth/refresh' || path === '/api/auth/sign-out';
    },
    validate: { xForwardedForHeader: true },
    ...(useRedisStore ? { store: redisStore('rl:bp:auth:') } : {}),
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
  app.use('/api', requestTimeout);
  app.use('/api/auth', authLimiter, authRouter);
  app.use('/api/student', studentPortalRouter);
  app.use('/api/students', studentsRouter);
  app.use('/api/sponsors', sponsorsRouter);
  app.use('/api/contests', contestsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/activities', activitiesRouter);
  app.use('/api/banks', banksRouter);
  app.use('/api/registrations', registrationsRouter);
  app.use('/api/attempts', attemptsRouter);
  app.use('/api/admin/attempts', adminAttemptsRouter);
  app.use('/api/leaderboards', leaderboardsRouter);
  app.use('/api/student/leaderboards', studentLeaderboardsRouter);
  app.use('/api/results', resultsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/files', filesRouter);

  app.use(errorHandler);
  return app;
}
