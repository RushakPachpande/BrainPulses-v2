import { prisma } from './src/lib/prisma.js';

const rows = await prisma.$queryRawUnsafe(
  "SELECT to_regclass('public.contest_registration_forms')::text AS name",
);
const applied = await prisma.$queryRawUnsafe(
  "SELECT migration_name FROM _prisma_migrations WHERE migration_name LIKE '%contest_registration%'",
);
console.log(JSON.stringify({ rows, applied }));
await prisma.$disconnect();
