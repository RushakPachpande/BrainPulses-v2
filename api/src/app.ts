import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { RedisStore } from 'rate-limit-redis';
import { env } from './config/env.js';
import { createCorsOriginDelegate } from './lib/cors-origin.js';
import { getRedis, isRedisReady } from './lib/redis.js';

import { eventLoopLagMs } from './lib/event-loop.js';
import { lazyRouter } from './lib/lazy-router.js';
import { rateLimitKey, rateLimitMax } from './lib/rate-limit-key.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestId } from './middleware/request-id.js';
import { requestLog } from './middleware/request-log.js';
import { requestTimeout } from './middleware/request-timeout.js';

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
    keyGenerator: (req) => rateLimitKey(req),
    max: (req) => rateLimitMax(req, { actor: env.RATE_LIMIT_MAX_ACTOR, ip: env.RATE_LIMIT_MAX_IP }),
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
    const { getPoolStats, prisma } = await import('./lib/prisma.js');
    const pool = getPoolStats();
    const lagMs = eventLoopLagMs();
    let postgres = false;
    let redis = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      postgres = true;
      if (!isRedisReady()) {
        res.status(503).json({
          ok: false,
          postgres,
          redis: false,
          pool,
          eventLoopLagMs: lagMs,
        });
        return;
      }
      await getRedis().ping();
      redis = true;
      res.json({ ok: true, postgres, redis, pool, eventLoopLagMs: lagMs });
    } catch {
      res.status(503).json({
        ok: false,
        postgres,
        redis: redis && isRedisReady(),
        pool,
        eventLoopLagMs: lagMs,
      });
    }
  });

  app.use('/api', apiLimiter);
  app.use('/api', requestLog);
  app.use('/api', requestTimeout);
  // Prevent browsers from serving stale authenticated JSON after hard reload.
  app.use('/api', (req, res, next) => {
    if (!req.path.startsWith('/files')) {
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  });
  app.use(
    '/api/auth',
    authLimiter,
    lazyRouter(() => import('./modules/auth/routes.js').then((m) => m.authRouter)),
  );
  app.use(
    '/api/public/contest-forms',
    lazyRouter(() =>
      import('./modules/contest-forms/routes.js').then((m) => m.publicContestFormsRouter),
    ),
  );
  app.use(
    '/api/participant',
    lazyRouter(() =>
      import('./modules/participant-portal/routes.js').then((m) => m.participantPortalRouter),
    ),
  );
  app.use(
    '/api/participants',
    lazyRouter(() => import('./modules/participants/routes.js').then((m) => m.participantsRouter)),
  );
  app.use(
    '/api/sponsors',
    lazyRouter(() => import('./modules/sponsors/routes.js').then((m) => m.sponsorsRouter)),
  );
  app.use(
    '/api/contests',
    lazyRouter(() => import('./modules/contests/routes.js').then((m) => m.contestsRouter)),
  );
  app.use(
    '/api/contest-forms',
    lazyRouter(() => import('./modules/contest-forms/routes.js').then((m) => m.contestFormsRouter)),
  );
  app.use(
    '/api/users',
    lazyRouter(() => import('./modules/users/routes.js').then((m) => m.usersRouter)),
  );
  app.use(
    '/api/activities',
    lazyRouter(() => import('./modules/activities/routes.js').then((m) => m.activitiesRouter)),
  );
  app.use(
    '/api/banks',
    lazyRouter(() => import('./modules/banks/routes.js').then((m) => m.banksRouter)),
  );
  app.use(
    '/api/registrations',
    lazyRouter(() =>
      import('./modules/registrations/routes.js').then((m) => m.registrationsRouter),
    ),
  );
  app.use(
    '/api/attempts',
    lazyRouter(() => import('./modules/attempts/routes.js').then((m) => m.attemptsRouter)),
  );
  app.use(
    '/api/admin/attempts',
    lazyRouter(() =>
      import('./modules/attempts/admin-routes.js').then((m) => m.adminAttemptsRouter),
    ),
  );
  app.use(
    '/api/results',
    lazyRouter(() => import('./modules/results/routes.js').then((m) => m.resultsRouter)),
  );
  app.use(
    '/api/quiz-reports',
    lazyRouter(() => import('./modules/quiz-reports/routes.js').then((m) => m.quizReportsRouter)),
  );
  app.use(
    '/api/assessment-reports',
    lazyRouter(() =>
      import('./modules/assessment-reports/routes.js').then((m) => m.assessmentReportsRouter),
    ),
  );
  app.use(
    '/api/dashboard',
    lazyRouter(() => import('./modules/dashboard/routes.js').then((m) => m.dashboardRouter)),
  );
  app.use(
    '/api/settings',
    lazyRouter(() => import('./modules/settings/routes.js').then((m) => m.settingsRouter)),
  );
  app.use(
    '/api/audit',
    lazyRouter(() => import('./modules/audit/routes.js').then((m) => m.auditRouter)),
  );
  app.use(
    '/api/files',
    lazyRouter(() => import('./modules/files/routes.js').then((m) => m.filesRouter)),
  );
  app.use(
    '/api/jobs',
    lazyRouter(() => import('./modules/jobs/routes.js').then((m) => m.jobsRouter)),
  );

  app.use(errorHandler);
  return app;
}
