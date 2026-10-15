import '../src/config/load-env.js';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { PrismaClient } from '#prisma';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

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
      update: {},
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

  const bank = await prisma.questionBank.upsert({
    where: {
      organizationId_code: { organizationId: org.id, code: 'QB-26001' },
    },
    update: {},
    create: {
      organizationId: org.id,
      kind: 'assessment',
      code: 'QB-26001',
      name: 'Physics Fundamentals',
      description: 'Core concepts & numericals',
      status: 'active',
    },
  });

  let question = await prisma.question.findFirst({
    where: { organizationId: org.id, bankId: bank.id, code: 'Q-001' },
  });
  if (!question) {
    question = await prisma.question.create({
      data: {
        organizationId: org.id,
        bankId: bank.id,
        code: 'Q-001',
        type: 'single_mcq',
        stem: 'What is the SI unit of force?',
        points: 1,
      },
    });
    await prisma.questionVersion.create({
      data: {
        organizationId: org.id,
        questionId: question.id,
        version: 1,
        type: 'single_mcq',
        stem: 'What is the SI unit of force?',
        points: 1,
        answerKey: { correctLabels: ['B'] },
        options: {
          create: [
            { questionId: question.id, label: 'A', body: 'Joule', sortOrder: 0, isCorrect: false },
            { questionId: question.id, label: 'B', body: 'Newton', sortOrder: 1, isCorrect: true },
            { questionId: question.id, label: 'C', body: 'Watt', sortOrder: 2, isCorrect: false },
            { questionId: question.id, label: 'D', body: 'Pascal', sortOrder: 3, isCorrect: false },
          ],
        },
      },
    });
  }

  const activity = await prisma.activity.upsert({
    where: {
      organizationId_code: { organizationId: org.id, code: 'ASM-26001' },
    },
    update: { status: 'active' },
    create: {
      organizationId: org.id,
      kind: 'assessment',
      code: 'ASM-26001',
      name: 'JEE Mock Series 2026',
      subtitle: 'Engineering • Mock Test',
      status: 'active',
      startsAt: new Date(Date.now() - 86_400_000),
      endsAt: new Date(Date.now() + 30 * 86_400_000),
      durationMinutes: 60,
      passingPercent: 40,
    },
  });

  await prisma.activityBank.upsert({
    where: {
      activityId_bankId: { activityId: activity.id, bankId: bank.id },
    },
    update: {},
    create: {
      organizationId: org.id,
      activityId: activity.id,
      bankId: bank.id,
    },
  });

  for (const student of students) {
    await prisma.registration.upsert({
      where: {
        organizationId_activityId_studentId: {
          organizationId: org.id,
          activityId: activity.id,
          studentId: student.id,
        },
      },
      update: { status: 'assigned', assignedAt: new Date() },
      create: {
        organizationId: org.id,
        activityId: activity.id,
        studentId: student.id,
        status: 'assigned',
        assignedAt: new Date(),
      },
    });
  }

  await prisma.student.upsert({
    where: {
      organizationId_code: { organizationId: orgB.id, code: 'BP-99001' },
    },
    update: {},
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
