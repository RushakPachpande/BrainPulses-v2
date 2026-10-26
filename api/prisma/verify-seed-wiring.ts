import '../src/config/load-env.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '#prisma';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const org = await prisma.organization.findUniqueOrThrow({ where: { slug: 'demo' } });
const quizzes = await prisma.activity.findMany({
  where: { organizationId: org.id, kind: 'quiz' },
  include: { sponsor: true, contest: true, activityBanks: true },
});
const bad = quizzes.filter(
  (quiz) =>
    !quiz.sponsorId ||
    !quiz.contestId ||
    !quiz.contest ||
    quiz.contest.sponsorId !== quiz.sponsorId ||
    !quiz.startsAt ||
    !quiz.endsAt ||
    quiz.activityBanks.length === 0,
);
const sponsors = await prisma.sponsor.count({
  where: { organizationId: org.id, image: { finalizedAt: { not: null } } },
});
const contests = await prisma.contest.count({
  where: { organizationId: org.id, image: { finalizedAt: { not: null } } },
});
const archive = await prisma.activity.findFirstOrThrow({
  where: { organizationId: org.id, code: 'ASM-ARCHIVE' },
  include: { _count: { select: { rounds: true, registrations: true, attempts: true } } },
});
const draftRegs = await prisma.registration.count({
  where: { activity: { organizationId: org.id, code: 'QZ-DRAFT' } },
});
console.log(
  JSON.stringify(
    {
      quizzes: quizzes.map((quiz) => ({
        code: quiz.code,
        sponsor: quiz.sponsor?.name,
        contest: quiz.contest?.name,
        banks: quiz.activityBanks.length,
        mode: quiz.durationMode,
      })),
      bad: bad.length,
      sponsors,
      contests,
      archive: archive._count,
      draftRegs,
    },
    null,
    2,
  ),
);
await prisma.$disconnect();
await pool.end();
