import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '#prisma';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool } from 'pg';
import { env } from '../config/env.js';

export type TenantContext = {
  organizationId: string;
};

export const tenantStore = new AsyncLocalStorage<TenantContext>();

const TENANT_MODELS = new Set([
  'student',
  'questionBank',
  'question',
  'questionVersion',
  'activity',
  'activityBank',
  'registration',
  'attempt',
  'attemptResponse',
  'result',
  'resultRevision',
  'setting',
  'notification',
  'auditEvent',
  'fileObject',
  'membership',
]);

/** Operations whose where clause accepts non-unique filters. */
const FILTER_OPS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

function ensureOrgInWhere(model: string, args: { where?: Record<string, unknown> }) {
  const ctx = tenantStore.getStore();
  if (!ctx) return;
  if (!TENANT_MODELS.has(model)) return;

  const where = { ...(args.where ?? {}) };
  if (!('organizationId' in where)) {
    where.organizationId = ctx.organizationId;
  } else if (where.organizationId !== ctx.organizationId) {
    throw new Error(`Tenant scope mismatch: ${model} query org does not match request context`);
  }
  args.where = where;
}

function injectOrgOnCreate(
  model: string,
  args: { data?: Record<string, unknown> | Record<string, unknown>[] },
) {
  const ctx = tenantStore.getStore();
  if (!ctx) return;
  if (!TENANT_MODELS.has(model)) return;
  if (!args.data) return;

  if (Array.isArray(args.data)) {
    args.data = args.data.map((row) => ({
      organizationId: ctx.organizationId,
      ...row,
    }));
  } else if (!('organizationId' in args.data)) {
    args.data = { organizationId: ctx.organizationId, ...args.data };
  } else if (args.data.organizationId !== ctx.organizationId) {
    throw new Error(`Tenant scope mismatch on ${model} create`);
  }
}

function assertResultOrg(model: string, result: unknown) {
  const ctx = tenantStore.getStore();
  if (!ctx || !TENANT_MODELS.has(model) || result == null) return result;
  if (typeof result === 'object' && 'organizationId' in result) {
    const orgId = (result as { organizationId: string }).organizationId;
    if (orgId !== ctx.organizationId) {
      return null;
    }
  }
  return result;
}

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

const adapter = new PrismaPg(pool);

const basePrisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const modelName = model.charAt(0).toLowerCase() + model.slice(1);
        const ctx = tenantStore.getStore();

        if (FILTER_OPS.has(operation)) {
          ensureOrgInWhere(modelName, args as { where?: Record<string, unknown> });
        }

        if (operation === 'create' || operation === 'createMany') {
          injectOrgOnCreate(modelName, args as { data?: Record<string, unknown> });
        }

        if (operation === 'upsert') {
          const upsertArgs = args as { create?: Record<string, unknown> };
          if (upsertArgs.create) {
            injectOrgOnCreate(modelName, { data: upsertArgs.create });
          }
        }

        if (
          ctx &&
          TENANT_MODELS.has(modelName) &&
          (operation === 'update' || operation === 'delete')
        ) {
          const where = (args as { where: Record<string, unknown> }).where;
          if (!('organizationId' in where)) {
            const existing = await (
              basePrisma as unknown as Record<
                string,
                { findFirst: (a: unknown) => Promise<{ organizationId: string } | null> }
              >
            )[modelName]!.findFirst({
              where: { ...where, organizationId: ctx.organizationId },
              select: { organizationId: true },
            });
            if (!existing) {
              const err = new Error('Record to update/delete not found in tenant scope');
              (err as { code?: string }).code = 'P2025';
              throw err;
            }
          } else if (where.organizationId !== ctx.organizationId) {
            throw new Error(`Tenant scope mismatch on ${modelName} ${operation}`);
          }
        }

        const result = await query(args);

        if (
          operation === 'findUnique' ||
          operation === 'findUniqueOrThrow' ||
          operation === 'findFirst' ||
          operation === 'findFirstOrThrow'
        ) {
          return assertResultOrg(modelName, result);
        }

        return result;
      },
    },
  },
});

export type Prisma = typeof prisma;

export async function withTenant<T>(organizationId: string, fn: () => Promise<T>): Promise<T> {
  return tenantStore.run({ organizationId }, fn);
}

export async function disconnectPrisma(): Promise<void> {
  await basePrisma.$disconnect();
  await pool.end();
}
