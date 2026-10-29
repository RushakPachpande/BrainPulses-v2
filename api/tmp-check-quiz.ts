import { prisma } from './src/lib/prisma.js';

const rows = await prisma.activity.findMany({
  where: { kind: 'quiz' },
  select: {
    code: true,
    name: true,
    settings: true,
    activityBanks: { select: { bank: { select: { origin: true, code: true } } } },
  },
});

for (const row of rows) {
  const settings = row.settings;
  const quiz =
    settings && typeof settings === 'object' && !Array.isArray(settings)
      ? (settings as { quiz?: Record<string, unknown> }).quiz
      : null;
  const banks = row.activityBanks.map((link) => `${link.bank.origin}:${link.bank.code}`).join(',');
  console.log(
    [
      row.code,
      row.name,
      String(quiz?.scoreRelease ?? ''),
      String(quiz?.maxAttempts ?? ''),
      banks,
    ].join(' | '),
  );
}

await prisma.$disconnect();
