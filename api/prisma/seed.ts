import '../src/config/load-env.js';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { PrismaClient, type ActivityKind } from '#prisma';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

type McqSeed = {
  code: string;
  stem: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
};

async function ensureMcq(organizationId: string, bankId: string, q: McqSeed): Promise<void> {
  const existing = await prisma.question.findFirst({
    where: { organizationId, bankId, code: q.code },
  });
  if (existing) return;

  const labels = ['A', 'B', 'C', 'D'] as const;
  const question = await prisma.question.create({
    data: {
      organizationId,
      bankId,
      code: q.code,
      type: 'single_mcq',
      stem: q.stem,
      points: 1,
    },
  });
  await prisma.questionVersion.create({
    data: {
      organizationId,
      questionId: question.id,
      version: 1,
      type: 'single_mcq',
      stem: q.stem,
      points: 1,
      answerKey: { correctLabels: [labels[q.correctIndex]] },
      options: {
        create: q.options.map((body, sortOrder) => ({
          questionId: question.id,
          label: labels[sortOrder]!,
          body,
          sortOrder,
          isCorrect: sortOrder === q.correctIndex,
        })),
      },
    },
  });
}

async function ensureBankWithQuestions(input: {
  organizationId: string;
  kind: ActivityKind;
  code: string;
  name: string;
  description: string;
  questions: McqSeed[];
}) {
  const bank = await prisma.questionBank.upsert({
    where: {
      organizationId_code: {
        organizationId: input.organizationId,
        code: input.code,
      },
    },
    update: { status: 'active', name: input.name, description: input.description },
    create: {
      organizationId: input.organizationId,
      kind: input.kind,
      code: input.code,
      name: input.name,
      description: input.description,
      status: 'active',
    },
  });
  for (const q of input.questions) {
    await ensureMcq(input.organizationId, bank.id, q);
  }
  return bank;
}

async function ensureActivity(input: {
  organizationId: string;
  kind: ActivityKind;
  code: string;
  name: string;
  subtitle: string;
  durationMinutes: number;
  bankId: string;
  studentIds: string[];
}) {
  const activity = await prisma.activity.upsert({
    where: {
      organizationId_code: {
        organizationId: input.organizationId,
        code: input.code,
      },
    },
    update: {
      status: 'active',
      name: input.name,
      subtitle: input.subtitle,
      durationMinutes: input.durationMinutes,
      startsAt: new Date(Date.now() - 86_400_000),
      endsAt: new Date(Date.now() + 30 * 86_400_000),
    },
    create: {
      organizationId: input.organizationId,
      kind: input.kind,
      code: input.code,
      name: input.name,
      subtitle: input.subtitle,
      status: 'active',
      startsAt: new Date(Date.now() - 86_400_000),
      endsAt: new Date(Date.now() + 30 * 86_400_000),
      durationMinutes: input.durationMinutes,
      passingPercent: 40,
    },
  });

  await prisma.activityBank.upsert({
    where: {
      activityId_bankId: { activityId: activity.id, bankId: input.bankId },
    },
    update: {},
    create: {
      organizationId: input.organizationId,
      activityId: activity.id,
      bankId: input.bankId,
    },
  });

  for (const studentId of input.studentIds) {
    await prisma.registration.upsert({
      where: {
        organizationId_activityId_studentId: {
          organizationId: input.organizationId,
          activityId: activity.id,
          studentId,
        },
      },
      update: { status: 'assigned', assignedAt: new Date() },
      create: {
        organizationId: input.organizationId,
        activityId: activity.id,
        studentId,
        status: 'assigned',
        assignedAt: new Date(),
      },
    });
  }

  return activity;
}

const assessmentQuestions: McqSeed[] = [
  {
    code: 'Q-001',
    stem: 'What is the SI unit of force?',
    options: ['Joule', 'Newton', 'Watt', 'Pascal'],
    correctIndex: 1,
  },
  {
    code: 'Q-002',
    stem: 'Acceleration due to gravity on Earth is approximately:',
    options: ['1.6 m/s²', '9.8 m/s²', '3×10⁸ m/s', '100 N'],
    correctIndex: 1,
  },
  {
    code: 'Q-003',
    stem: 'Which quantity is conserved in an isolated system with no external torque?',
    options: ['Linear momentum', 'Angular momentum', 'Kinetic energy only', 'Temperature'],
    correctIndex: 1,
  },
  {
    code: 'Q-004',
    stem: 'Ohm’s law relates voltage (V), current (I), and resistance (R) as:',
    options: ['V = I / R', 'V = I × R', 'V = I² × R', 'V = R / I'],
    correctIndex: 1,
  },
  {
    code: 'Q-005',
    stem: 'The chemical formula of water is:',
    options: ['CO₂', 'H₂O', 'NaCl', 'O₂'],
    correctIndex: 1,
  },
];

const quizQuestions: McqSeed[] = [
  {
    code: 'Q-101',
    stem: 'Which planet is known as the Red Planet?',
    options: ['Venus', 'Mars', 'Jupiter', 'Mercury'],
    correctIndex: 1,
  },
  {
    code: 'Q-102',
    stem: 'What is the value of 15% of 240?',
    options: ['24', '30', '36', '40'],
    correctIndex: 2,
  },
  {
    code: 'Q-103',
    stem: 'Which HTML element is used for the largest heading by default?',
    options: ['<heading>', '<h6>', '<head>', '<h1>'],
    correctIndex: 3,
  },
  {
    code: 'Q-104',
    stem: 'Which JavaScript array method creates a new array by transforming each item?',
    options: ['map()', 'find()', 'push()', 'includes()'],
    correctIndex: 0,
  },
  {
    code: 'Q-105',
    stem: 'Which gas do plants absorb during photosynthesis?',
    options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'],
    correctIndex: 2,
  },
];

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 12);

  const org = await prisma.organization.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'BrainPulses Demo',
      slug: 'demo',
    },
  });

  const orgB = await prisma.organization.upsert({
    where: { slug: 'other' },
    update: {},
    create: {
      name: 'Other Org',
      slug: 'other',
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@brainpulses.com' },
    update: { passwordHash },
    create: {
      email: 'admin@brainpulses.com',
      name: 'Meera Joshi',
      passwordHash,
    },
  });

  const viewOnly = await prisma.user.upsert({
    where: { email: 'viewer@brainpulses.com' },
    update: { passwordHash },
    create: {
      email: 'viewer@brainpulses.com',
      name: 'View Only',
      passwordHash,
    },
  });

  await prisma.membership.upsert({
    where: {
      organizationId_userId: { organizationId: org.id, userId: admin.id },
    },
    update: { role: 'super_admin', assessmentAccess: 'full', quizAccess: 'full' },
    create: {
      organizationId: org.id,
      userId: admin.id,
      role: 'super_admin',
      assessmentAccess: 'full',
      quizAccess: 'full',
    },
  });

  await prisma.membership.upsert({
    where: {
      organizationId_userId: { organizationId: orgB.id, userId: admin.id },
    },
    update: { role: 'admin' },
    create: {
      organizationId: orgB.id,
      userId: admin.id,
      role: 'admin',
      assessmentAccess: 'full',
      quizAccess: 'full',
    },
  });

  await prisma.membership.upsert({
    where: {
      organizationId_userId: { organizationId: org.id, userId: viewOnly.id },
    },
    update: { assessmentAccess: 'view', quizAccess: 'view' },
    create: {
      organizationId: org.id,
      userId: viewOnly.id,
      role: 'admin',
      assessmentAccess: 'view',
      quizAccess: 'view',
    },
  });

  const studentPw = await bcrypt.hash('Student123!', 12);
  const students = [];
  for (let i = 0; i < 3; i++) {
    const student = await prisma.student.upsert({
      where: {
        organizationId_code: { organizationId: org.id, code: `BP-${24101 + i}` },
      },
      update: { passwordHash: studentPw, isActive: true },
      create: {
        organizationId: org.id,
        code: `BP-${24101 + i}`,
        name: ['Priya Patel', 'Rohan Mehta', 'Sana Khan'][i]!,
        email: `student${i + 1}@mail.com`,
        phone: `+91 98765${10000 + i}`,
        course: ['JEE', 'Aptitude', 'Scholarship'][i],
        city: ['Pune', 'Mumbai', 'Delhi'][i],
        passwordHash: studentPw,
      },
    });
    students.push(student);
  }
  const studentIds = students.map((s) => s.id);

  const assessmentBank = await ensureBankWithQuestions({
    organizationId: org.id,
    kind: 'assessment',
    code: 'QB-26001',
    name: 'Physics Fundamentals',
    description: 'Core concepts & numericals',
    questions: assessmentQuestions,
  });

  const quizBank = await ensureBankWithQuestions({
    organizationId: org.id,
    kind: 'quiz',
    code: 'QB-26002',
    name: 'General Knowledge Blitz',
    description: 'Quick practice across science and web basics',
    questions: quizQuestions,
  });

  await ensureActivity({
    organizationId: org.id,
    kind: 'assessment',
    code: 'ASM-26001',
    name: 'JEE Mock Series 2026',
    subtitle: 'Engineering • Mock Test',
    durationMinutes: 60,
    bankId: assessmentBank.id,
    studentIds,
  });

  await ensureActivity({
    organizationId: org.id,
    kind: 'quiz',
    code: 'QZ-26001',
    name: 'Weekly General Knowledge',
    subtitle: 'General knowledge · Weekly practice',
    durationMinutes: 15,
    bankId: quizBank.id,
    studentIds,
  });

  await ensureActivity({
    organizationId: org.id,
    kind: 'quiz',
    code: 'QZ-26002',
    name: 'Maths Sprint #12',
    subtitle: 'Quantitative aptitude · Timed quiz',
    durationMinutes: 20,
    bankId: quizBank.id,
    studentIds,
  });

  await prisma.student.upsert({
    where: {
      organizationId_code: { organizationId: orgB.id, code: 'BP-99001' },
    },
    update: { passwordHash: studentPw },
    create: {
      organizationId: orgB.id,
      code: 'BP-99001',
      name: 'Other Student',
      email: 'other.student@mail.com',
      passwordHash: studentPw,
    },
  });

  console.log('Seed complete.');
  console.log('  admin@brainpulses.com / Password123!');
  console.log('  viewer@brainpulses.com / Password123! (view-only)');
  console.log('  student1@mail.com / Student123!');
  console.log('  Activities: ASM-26001, QZ-26001, QZ-26002 (assigned to demo students)');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
