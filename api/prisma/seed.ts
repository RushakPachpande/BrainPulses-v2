import '../src/config/load-env.js';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { PrismaClient, type ActivityKind, type FlowStatus } from '#prisma';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const LABELS = ['A', 'B', 'C', 'D'] as const;

type McqSeed = {
  code: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  points?: number;
};

type StudentSeed = {
  code: string;
  name: string;
  email: string;
  phone: string;
  course: string;
  city: string;
  cohort: string;
};

const day = 86_400_000;

function daysFromNow(d: number) {
  return new Date(Date.now() + d * day);
}

function daysAgo(d: number) {
  return new Date(Date.now() - d * day);
}

function pngChunk(type: string, data: Buffer) {
  const typeBuf = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([length, typeBuf, data, crc]);
}

/** Small solid PNG so sponsor and contest images are real uploaded files. */
function solidPng(size: number, rgb: [number, number, number]) {
  const [red, green, blue] = rgb;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.alloc(1 + size * 3);
  for (let x = 0; x < size; x += 1) {
    row[1 + x * 3] = red;
    row[2 + x * 3] = green;
    row[3 + x * 3] = blue;
  }
  const raw = Buffer.concat(Array.from({ length: size }, () => Buffer.from(row)));
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

async function seedImage(input: {
  organizationId: string;
  uploadedById: string;
  fileName: string;
  rgb: [number, number, number];
}) {
  const dir = path.resolve(process.env.UPLOAD_DIR ?? './uploads', input.organizationId);
  await mkdir(dir, { recursive: true });
  const bytes = solidPng(64, input.rgb);
  const storagePath = path.join(dir, input.fileName);
  await writeFile(storagePath, bytes);
  return prisma.fileObject.create({
    data: {
      organizationId: input.organizationId,
      uploadedById: input.uploadedById,
      originalName: input.fileName,
      mimeType: 'image/png',
      sizeBytes: bytes.length,
      storagePath,
      finalizedAt: new Date(),
    },
  });
}

const quizBehaviourSettings = {
  quiz: {
    shuffleQuestions: true,
    shuffleOptions: true,
    scoreRelease: 'after_publish' as const,
    answersVisibleToStudent: true,
    maxAttempts: 1,
  },
};

/** Clear one organization's content so a reseed can replace it. Keeps users, memberships, and the organization. */
async function wipeOrganizationContent(organizationId: string) {
  await prisma.resultRevision.deleteMany({ where: { organizationId } });
  await prisma.result.deleteMany({ where: { organizationId } });
  await prisma.attemptResponse.deleteMany({ where: { organizationId } });
  await prisma.attempt.deleteMany({ where: { organizationId } });
  await prisma.reattemptGrant.deleteMany({ where: { organizationId } });
  await prisma.registration.deleteMany({ where: { organizationId } });
  await prisma.activityRoundBank.deleteMany({ where: { organizationId } });
  await prisma.activityRound.updateMany({
    where: { organizationId },
    data: { localBankId: null },
  });
  await prisma.activityRound.deleteMany({ where: { organizationId } });
  await prisma.activityBank.deleteMany({ where: { organizationId } });
  await prisma.activity.deleteMany({ where: { organizationId } });
  await prisma.contest.deleteMany({ where: { organizationId } });
  await prisma.sponsor.deleteMany({ where: { organizationId } });
  const files = await prisma.fileObject.findMany({
    where: { organizationId },
    select: { id: true, storagePath: true },
  });
  for (const file of files) {
    await unlink(file.storagePath).catch(() => undefined);
  }
  if (files.length > 0) {
    await prisma.fileObject.deleteMany({
      where: { organizationId, id: { in: files.map((file) => file.id) } },
    });
  }
  await prisma.notification.deleteMany({ where: { organizationId } });
  await prisma.auditEvent.deleteMany({ where: { organizationId } });
  await prisma.setting.deleteMany({ where: { organizationId } });
  // Options → versions → questions → banks (attempt responses already gone)
  const banks = await prisma.questionBank.findMany({
    where: { organizationId },
    select: { id: true },
  });
  const bankIds = banks.map((b) => b.id);
  if (bankIds.length > 0) {
    const questions = await prisma.question.findMany({
      where: { organizationId, bankId: { in: bankIds } },
      select: { id: true },
    });
    const questionIds = questions.map((q) => q.id);
    if (questionIds.length > 0) {
      await prisma.questionOption.deleteMany({ where: { questionId: { in: questionIds } } });
      await prisma.questionVersion.deleteMany({
        where: { organizationId, questionId: { in: questionIds } },
      });
      await prisma.question.deleteMany({ where: { organizationId, id: { in: questionIds } } });
    }
    await prisma.questionBank.deleteMany({ where: { organizationId, id: { in: bankIds } } });
  }
  await prisma.student.deleteMany({ where: { organizationId } });
}

async function upsertMcq(organizationId: string, bankId: string, q: McqSeed) {
  const points = q.points ?? 1;
  const answerKey = { correctLabels: [LABELS[q.correctIndex]] };

  const existing = await prisma.question.findFirst({
    where: { organizationId, bankId, code: q.code },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  });

  if (!existing) {
    const question = await prisma.question.create({
      data: {
        organizationId,
        bankId,
        code: q.code,
        type: 'single_mcq',
        question: q.question,
        points,
        isActive: true,
      },
    });
    await prisma.questionVersion.create({
      data: {
        organizationId,
        questionId: question.id,
        version: 1,
        type: 'single_mcq',
        question: q.question,
        points,
        answerKey,
        options: {
          create: q.options.map((body, sortOrder) => ({
            questionId: question.id,
            label: LABELS[sortOrder]!,
            body,
            sortOrder,
            isCorrect: sortOrder === q.correctIndex,
          })),
        },
      },
    });
    return;
  }

  await prisma.question.update({
    where: { id: existing.id },
    data: { question: q.question, points, type: 'single_mcq', isActive: true },
  });

  const latest = existing.versions[0];
  if (!latest) {
    await prisma.questionVersion.create({
      data: {
        organizationId,
        questionId: existing.id,
        version: 1,
        type: 'single_mcq',
        question: q.question,
        points,
        answerKey,
        options: {
          create: q.options.map((body, sortOrder) => ({
            questionId: existing.id,
            label: LABELS[sortOrder]!,
            body,
            sortOrder,
            isCorrect: sortOrder === q.correctIndex,
          })),
        },
      },
    });
    return;
  }

  await prisma.questionOption.deleteMany({ where: { questionVersionId: latest.id } });
  await prisma.questionVersion.update({
    where: { id: latest.id },
    data: {
      question: q.question,
      points,
      type: 'single_mcq',
      answerKey,
      options: {
        create: q.options.map((body, sortOrder) => ({
          questionId: existing.id,
          label: LABELS[sortOrder]!,
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
  origin?: 'reusable' | 'round_local' | 'quiz_local';
  status?: FlowStatus;
}) {
  const bank = await prisma.questionBank.create({
    data: {
      organizationId: input.organizationId,
      kind: input.kind,
      code: input.code,
      name: input.name,
      description: input.description,
      status: input.status ?? 'active',
      origin: input.origin ?? 'reusable',
    },
  });
  for (const q of input.questions) {
    await upsertMcq(input.organizationId, bank.id, q);
  }
  return bank;
}

async function registerStudents(organizationId: string, activityId: string, studentIds: string[]) {
  for (const studentId of studentIds) {
    await prisma.registration.create({
      data: {
        organizationId,
        activityId,
        studentId,
        status: 'assigned',
        assignedAt: daysAgo(5),
      },
    });
  }
}

const foundationQuestions: McqSeed[] = [
  ['Q-01', 'What is the SI unit of force?', ['Joule', 'Newton', 'Watt', 'Pascal'], 1],
  ['Q-02', 'Which planet is known as the Red Planet?', ['Venus', 'Mars', 'Jupiter', 'Saturn'], 1],
  ['Q-03', 'What is 15% of 200?', ['20', '25', '30', '35'], 2],
  ['Q-04', 'Water freezes at what temperature in Celsius?', ['0', '32', '100', '-10'], 0],
  [
    'Q-05',
    'Which gas do plants absorb for photosynthesis?',
    ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'],
    2,
  ],
  ['Q-06', 'How many sides does a hexagon have?', ['5', '6', '7', '8'], 1],
  ['Q-07', 'Who wrote the play Hamlet?', ['Dickens', 'Shakespeare', 'Austen', 'Tolstoy'], 1],
  ['Q-08', 'What is the capital of Japan?', ['Seoul', 'Beijing', 'Tokyo', 'Bangkok'], 2],
  [
    'Q-09',
    'Which blood cells help clotting?',
    ['Red cells', 'White cells', 'Platelets', 'Plasma'],
    2,
  ],
  ['Q-10', 'What is the square root of 144?', ['10', '11', '12', '14'], 2],
  ['Q-11', 'Which ocean is the largest?', ['Atlantic', 'Indian', 'Arctic', 'Pacific'], 3],
  [
    'Q-12',
    'What does CPU stand for?',
    [
      'Central Processing Unit',
      'Computer Personal Unit',
      'Central Program Utility',
      'Control Processing User',
    ],
    0,
  ],
  [
    'Q-13',
    'Which metal is liquid at room temperature?',
    ['Iron', 'Mercury', 'Aluminium', 'Copper'],
    1,
  ],
  ['Q-14', 'How many minutes are in 2.5 hours?', ['120', '135', '150', '180'], 2],
  [
    'Q-15',
    'Which continent is the Sahara Desert on?',
    ['Asia', 'Africa', 'Australia', 'Europe'],
    1,
  ],
  ['Q-16', 'What is the chemical symbol for gold?', ['Ag', 'Au', 'Gd', 'Go'], 1],
  ['Q-17', 'Which number is prime?', ['21', '27', '29', '33'], 2],
  ['Q-18', 'Light travels fastest through which of these?', ['Water', 'Glass', 'Air', 'Vacuum'], 3],
  ['Q-19', 'Which organ pumps blood?', ['Lungs', 'Liver', 'Heart', 'Kidney'], 2],
  ['Q-20', 'What is 7 × 8?', ['54', '56', '58', '64'], 1],
].map(
  ([code, question, options, correctIndex]) =>
    ({
      code,
      question,
      options,
      correctIndex,
    }) as McqSeed,
);

const studentRoster: StudentSeed[] = [
  {
    code: 'BP-24101',
    name: 'Priya Patel',
    email: 'student1@mail.com',
    phone: '+919876510000',
    course: 'JEE',
    city: 'Pune',
    cohort: 'Alpha',
  },
  {
    code: 'BP-24102',
    name: 'Rohan Mehta',
    email: 'student2@mail.com',
    phone: '+919876510001',
    course: 'JEE',
    city: 'Mumbai',
    cohort: 'Beta',
  },
  {
    code: 'BP-24103',
    name: 'Sana Khan',
    email: 'student3@mail.com',
    phone: '+919876510002',
    course: 'NEET',
    city: 'Delhi',
    cohort: 'Alpha',
  },
  {
    code: 'BP-24104',
    name: 'Arjun Nair',
    email: 'arjun.nair@nextgeninnov8.com',
    phone: '+919876510003',
    course: 'JEE',
    city: 'Bengaluru',
    cohort: 'Gamma',
  },
  {
    code: 'BP-24105',
    name: 'Ananya Iyer',
    email: 'ananya.iyer@nextgeninnov8.com',
    phone: '+919876510004',
    course: 'NEET',
    city: 'Chennai',
    cohort: 'Beta',
  },
  {
    code: 'BP-24106',
    name: 'Kabir Singh',
    email: 'kabir.singh@nextgeninnov8.com',
    phone: '+919876510005',
    course: 'Foundation',
    city: 'Jaipur',
    cohort: 'Alpha',
  },
  {
    code: 'BP-24107',
    name: 'Meera Desai',
    email: 'meera.desai@nextgeninnov8.com',
    phone: '+919876510006',
    course: 'JEE',
    city: 'Ahmedabad',
    cohort: 'Gamma',
  },
  {
    code: 'BP-24108',
    name: 'Ishaan Reddy',
    email: 'ishaan.reddy@nextgeninnov8.com',
    phone: '+919876510007',
    course: 'NEET',
    city: 'Hyderabad',
    cohort: 'Beta',
  },
  {
    code: 'BP-24109',
    name: 'Diya Sharma',
    email: 'diya.sharma@nextgeninnov8.com',
    phone: '+919876510008',
    course: 'Foundation',
    city: 'Lucknow',
    cohort: 'Alpha',
  },
  {
    code: 'BP-24110',
    name: 'Vivaan Joshi',
    email: 'vivaan.joshi@nextgeninnov8.com',
    phone: '+919876510009',
    course: 'JEE',
    city: 'Indore',
    cohort: 'Gamma',
  },
  {
    code: 'BP-24111',
    name: 'Aisha Begum',
    email: 'aisha.begum@nextgeninnov8.com',
    phone: '+919876510010',
    course: 'NEET',
    city: 'Kolkata',
    cohort: 'Beta',
  },
  {
    code: 'BP-24112',
    name: 'Neil Kapoor',
    email: 'neil.kapoor@nextgeninnov8.com',
    phone: '+919876510011',
    course: 'JEE',
    city: 'Chandigarh',
    cohort: 'Gamma',
  },
];

async function membership(
  organizationId: string,
  userId: string,
  role: 'super_admin' | 'admin',
  access: 'full' | 'view',
) {
  await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    update: { role, assessmentAccess: access, quizAccess: access, isActive: true },
    create: {
      organizationId,
      userId,
      role,
      assessmentAccess: access,
      quizAccess: access,
    },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 12);
  const existing = await prisma.organization.findMany({ select: { id: true } });
  for (const row of existing) {
    await wipeOrganizationContent(row.id);
  }
  await prisma.organization.deleteMany({
    where: { slug: { notIn: ['nextgeninnov8', 'greycaps'] } },
  });

  const nextgen = await prisma.organization.upsert({
    where: { slug: 'nextgeninnov8' },
    update: { name: 'NextGenInnov8', isActive: true },
    create: { name: 'NextGenInnov8', slug: 'nextgeninnov8' },
  });
  const greycaps = await prisma.organization.upsert({
    where: { slug: 'greycaps' },
    update: { name: 'GreyCaps', isActive: true },
    create: { name: 'GreyCaps', slug: 'greycaps' },
  });

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@brainpulses.com' },
    update: { passwordHash, name: 'Super Admin', isActive: true },
    create: { email: 'superadmin@brainpulses.com', name: 'Super Admin', passwordHash },
  });
  const admin = await prisma.user.upsert({
    where: { email: 'admin@brainpulses.com' },
    update: { passwordHash, name: 'Meera Joshi', isActive: true },
    create: { email: 'admin@brainpulses.com', name: 'Meera Joshi', passwordHash },
  });
  const viewer = await prisma.user.upsert({
    where: { email: 'viewer@brainpulses.com' },
    update: { passwordHash, name: 'Aryan Verma', isActive: true },
    create: { email: 'viewer@brainpulses.com', name: 'Aryan Verma', passwordHash },
  });

  for (const organizationId of [nextgen.id, greycaps.id]) {
    await membership(organizationId, superAdmin.id, 'super_admin', 'full');
    await membership(organizationId, admin.id, 'admin', 'full');
    await membership(organizationId, viewer.id, 'admin', 'view');
  }

  const students: { id: string }[] = [];
  for (const [index, row] of studentRoster.entries()) {
    const student = await prisma.student.create({
      data: {
        organizationId: nextgen.id,
        ...row,
        isActive: true,
        lastLoginAt: row.code === 'BP-24101' ? daysAgo(0) : daysAgo(1 + (index % 5)),
      },
    });
    students.push(student);
  }

  const bank = await ensureBankWithQuestions({
    organizationId: nextgen.id,
    kind: 'quiz',
    code: 'QB-26001',
    name: 'Foundation Question Bank',
    description: 'Twenty questions used by Launch Quiz.',
    questions: foundationQuestions,
    origin: 'quiz_local',
    status: 'active',
  });

  const sponsorMark = await seedImage({
    organizationId: nextgen.id,
    uploadedById: superAdmin.id,
    fileName: 'nextgen-sponsor.png',
    rgb: [37, 99, 235],
  });
  const contestMark = await seedImage({
    organizationId: nextgen.id,
    uploadedById: superAdmin.id,
    fileName: 'nextgen-contest.png',
    rgb: [14, 165, 233],
  });
  const sponsor = await prisma.sponsor.create({
    data: { organizationId: nextgen.id, name: 'NextGenInnov8', imageFileId: sponsorMark.id },
  });
  const contest = await prisma.contest.create({
    data: {
      organizationId: nextgen.id,
      sponsorId: sponsor.id,
      name: 'Launch Cup',
      description: 'Opening contest for NextGenInnov8 students.',
      imageFileId: contestMark.id,
    },
  });

  const quiz = await prisma.activity.create({
    data: {
      organizationId: nextgen.id,
      kind: 'quiz',
      code: 'QZ-26001',
      name: 'Launch Quiz',
      subtitle: 'Twenty questions in twenty minutes',
      status: 'active',
      startsAt: daysAgo(1),
      endsAt: daysFromNow(30),
      durationMinutes: 20,
      durationMode: 'overall',
      passingPercent: 40,
      presentation: 'one_at_a_time',
      sponsorId: sponsor.id,
      contestId: contest.id,
      settings: {
        registrationForm: { fields: [] },
        assignmentRules: { mode: 'manual', notes: 'Assigned to every NextGenInnov8 student.' },
        quiz: quizBehaviourSettings.quiz,
      },
      activityBanks: {
        create: { organizationId: nextgen.id, bankId: bank.id },
      },
    },
  });
  await registerStudents(
    nextgen.id,
    quiz.id,
    students.map((student) => student.id),
  );

  await prisma.setting.createMany({
    data: [
      {
        organizationId: nextgen.id,
        group: 'general',
        key: 'orgDisplayName',
        value: 'NextGenInnov8',
      },
      { organizationId: greycaps.id, group: 'general', key: 'orgDisplayName', value: 'GreyCaps' },
    ],
  });

  console.log('Seed complete.');
  console.log('  Organizations: NextGenInnov8 (nextgeninnov8), GreyCaps (greycaps)');
  console.log('  superadmin@brainpulses.com / Password123! (both orgs)');
  console.log('  admin@brainpulses.com / Password123! (both orgs)');
  console.log('  viewer@brainpulses.com / Password123! (view only, both orgs)');
  console.log('  Student Unique ID: BP-24101');
  console.log('  Quiz: QZ-26001 Launch Quiz, bank QB-26001 (20 questions)');
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
