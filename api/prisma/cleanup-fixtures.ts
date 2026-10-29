import '../src/config/load-env.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '#prisma';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const flagged = /\b(demo|temp|temporary|sample)\b/i;

const banks = await prisma.questionBank.findMany({
  select: { id: true, name: true, description: true },
});
const activities = await prisma.activity.findMany({
  select: { id: true, code: true, name: true, subtitle: true },
});
const contests = await prisma.contest.findMany({
  select: { id: true, name: true, description: true },
});

function hits(kind: string, rows: { id: string; values: string[] }[]) {
  return rows.flatMap((row) =>
    row.values.filter((value) => flagged.test(value)).map((value) => ({ kind, id: row.id, value })),
  );
}

console.log(
  'before',
  hits(
    'bank',
    banks.map((row) => ({ id: row.id, values: [row.name, row.description ?? ''] })),
  ),
  hits(
    'activity',
    activities.map((row) => ({ id: row.id, values: [row.name, row.subtitle ?? ''] })),
  ),
  hits(
    'contest',
    contests.map((row) => ({ id: row.id, values: [row.name, row.description ?? ''] })),
  ),
);

await prisma.questionBank.updateMany({
  where: { name: 'Sample Question Bank' },
  data: {
    name: 'Foundation Question Bank',
    description: 'Twenty single-choice questions used by Launch Quiz.',
  },
});
await prisma.activity.updateMany({
  where: { code: 'QZ-26001' },
  data: { subtitle: 'Twenty questions in twenty minutes' },
});
await prisma.contest.updateMany({
  where: { name: 'Launch Cup' },
  data: { description: 'Opening contest for NextGenInnov8 students.' },
});

const banksAfter = await prisma.questionBank.findMany({
  select: { name: true, description: true },
});
const activitiesAfter = await prisma.activity.findMany({
  select: { code: true, name: true, subtitle: true },
});
const contestsAfter = await prisma.contest.findMany({ select: { name: true, description: true } });
console.log('after', { banksAfter, activitiesAfter, contestsAfter });

await prisma.$disconnect();
await pool.end();
