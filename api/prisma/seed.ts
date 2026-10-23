import '../src/config/load-env.js';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import {
  PrismaClient,
  type ActivityKind,
  type FlowStatus,
  type Prisma,
  type ReleaseStatus,
} from '#prisma';

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

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3_600_000);
}

function daysFromNow(d: number) {
  return new Date(Date.now() + d * day);
}

function daysAgo(d: number) {
  return new Date(Date.now() - d * day);
}

const quizBehaviourSettings = {
  quiz: {
    shuffleQuestions: true,
    shuffleOptions: true,
    scoreVisibleToStudent: true,
    answersVisibleToStudent: true,
    dailyLeaderboardVisible: true,
    overallLeaderboardVisible: true,
    dailyGroupLeaderboardVisible: true,
    overallGroupLeaderboardVisible: true,
    countsForGroupLeaderboard: true,
    leaderboardReleasedAt: null as string | null,
  },
};

/** Wipe demo-org domain rows so reseed refreshes content. Keeps users/memberships/orgs. */
async function wipeDemoDomain(organizationId: string) {
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
  origin?: 'reusable' | 'round_local';
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

async function latestVersionIds(organizationId: string, bankId: string) {
  const questions = await prisma.question.findMany({
    where: { organizationId, bankId, isActive: true },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    orderBy: { code: 'asc' },
  });
  return questions.map((q) => q.versions[0]).filter((v): v is NonNullable<typeof v> => Boolean(v));
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

/** Build a submitted attempt with correct answers for `correctCount` questions (rest wrong). */
async function seedSubmittedAttempt(input: {
  organizationId: string;
  activityId: string;
  studentId: string;
  roundId?: string;
  versionIds: string[];
  correctCount: number;
  releaseStatus: ReleaseStatus;
  submittedAt: Date;
  startedAt: Date;
  deadlineAt: Date;
  disqualified?: boolean;
  disqualifiedByUserId?: string;
  isAuthoritative?: boolean;
}) {
  const versions = await prisma.questionVersion.findMany({
    where: { organizationId: input.organizationId, id: { in: input.versionIds } },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
  });
  const byId = new Map(versions.map((v) => [v.id, v]));
  const order = input.versionIds.filter((id) => byId.has(id));

  let score = 0;
  let maxScore = 0;
  const responses: {
    questionVersionId: string;
    answer: Prisma.InputJsonValue;
    revision: number;
  }[] = [];

  for (let i = 0; i < order.length; i += 1) {
    const v = byId.get(order[i]!)!;
    const pts = Number(v.points);
    maxScore += pts;
    const correctOpt = v.options.find((o) => o.isCorrect);
    const wrongOpt = v.options.find((o) => !o.isCorrect);
    const useCorrect = i < input.correctCount;
    if (useCorrect) score += pts;
    const label = useCorrect
      ? (correctOpt?.label ?? 'A')
      : (wrongOpt?.label ?? correctOpt?.label ?? 'B');
    responses.push({
      questionVersionId: v.id,
      answer: { label },
      revision: 1,
    });
  }

  const percent = maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0;
  const passed = percent >= 40;
  const disqualified = Boolean(input.disqualified);

  const attempt = await prisma.attempt.create({
    data: {
      organizationId: input.organizationId,
      activityId: input.activityId,
      roundId: input.roundId ?? null,
      studentId: input.studentId,
      status: 'submitted',
      revision: 1,
      startedAt: input.startedAt,
      deadlineAt: input.deadlineAt,
      submittedAt: input.submittedAt,
      submitIdempotencyKey: `seed-${input.activityId}-${input.studentId}-${input.roundId ?? 'flat'}`,
      questionOrder: order,
      optionOrders: {},
      isAuthoritative: input.isAuthoritative ?? !disqualified,
      disqualified,
      disqualifiedAt: disqualified ? input.submittedAt : null,
      disqualifiedByUserId: disqualified ? (input.disqualifiedByUserId ?? null) : null,
      disqualifiedNote: disqualified ? 'Seed: flagged for review during invigilation.' : null,
      responses: {
        create: responses.map((r) => ({
          organizationId: input.organizationId,
          questionVersionId: r.questionVersionId,
          answer: r.answer,
          revision: r.revision,
        })),
      },
    },
  });

  await prisma.result.create({
    data: {
      organizationId: input.organizationId,
      attemptId: attempt.id,
      activityId: input.activityId,
      studentId: input.studentId,
      score,
      maxScore,
      percent,
      passed,
      releaseStatus: input.releaseStatus,
      publishedAt: input.releaseStatus === 'published' ? input.submittedAt : null,
    },
  });

  return attempt;
}

/* ─── Question catalogs ─── */

const physicsQuestions: McqSeed[] = [
  {
    code: 'PHY-01',
    question: 'What is the SI unit of force?',
    options: ['Joule', 'Newton', 'Watt', 'Pascal'],
    correctIndex: 1,
  },
  {
    code: 'PHY-02',
    question: 'Acceleration due to gravity near Earth’s surface is approximately:',
    options: ['1.6 m/s²', '9.8 m/s²', '3.0×10⁸ m/s', '100 N/kg'],
    correctIndex: 1,
  },
  {
    code: 'PHY-03',
    question: 'In an isolated system with no external torque, which quantity is conserved?',
    options: ['Linear momentum only', 'Angular momentum', 'Kinetic energy only', 'Temperature'],
    correctIndex: 1,
  },
  {
    code: 'PHY-04',
    question: 'Ohm’s law relating voltage V, current I, and resistance R is:',
    options: ['V = I / R', 'V = I × R', 'V = I² × R', 'V = R / I'],
    correctIndex: 1,
  },
  {
    code: 'PHY-05',
    question: 'A body moving with constant velocity has:',
    options: [
      'Zero acceleration',
      'Increasing kinetic energy',
      'Non-zero net force',
      'Changing momentum',
    ],
    correctIndex: 0,
  },
  {
    code: 'PHY-06',
    question: 'The work done by a force is zero when the displacement is:',
    options: [
      'Parallel to the force',
      'Perpendicular to the force',
      'In the same direction as velocity',
      'Along the gravitational field',
    ],
    correctIndex: 1,
  },
  {
    code: 'PHY-07',
    question: 'Power is defined as:',
    options: [
      'Force × displacement',
      'Work done per unit time',
      'Mass × acceleration',
      'Charge × potential',
    ],
    correctIndex: 1,
  },
  {
    code: 'PHY-08',
    question: 'Which of the following is a scalar quantity?',
    options: ['Velocity', 'Force', 'Momentum', 'Energy'],
    correctIndex: 3,
  },
  {
    code: 'PHY-09',
    question: 'If mass is constant, Newton’s second law can be written as F =',
    options: ['m / a', 'm × a', 'm × v', 'a / m'],
    correctIndex: 1,
  },
  {
    code: 'PHY-10',
    question: 'The dimensional formula of pressure is the same as that of:',
    options: ['Force', 'Energy density', 'Momentum', 'Power'],
    correctIndex: 1,
  },
];

const chemistryQuestions: McqSeed[] = [
  {
    code: 'CHM-01',
    question: 'The chemical formula of water is:',
    options: ['CO₂', 'H₂O', 'NaCl', 'O₂'],
    correctIndex: 1,
  },
  {
    code: 'CHM-02',
    question: 'Atomic number of carbon is:',
    options: ['4', '6', '8', '12'],
    correctIndex: 1,
  },
  {
    code: 'CHM-03',
    question: 'pH of a neutral aqueous solution at 25 °C is approximately:',
    options: ['0', '7', '14', '1'],
    correctIndex: 1,
  },
  {
    code: 'CHM-04',
    question: 'Which gas is evolved when zinc reacts with dilute HCl?',
    options: ['Oxygen', 'Hydrogen', 'Chlorine', 'Nitrogen'],
    correctIndex: 1,
  },
  {
    code: 'CHM-05',
    question: 'Avogadro’s number is approximately:',
    options: ['6.022 × 10²³', '3.0 × 10⁸', '1.6 × 10⁻¹⁹', '9.8'],
    correctIndex: 0,
  },
  {
    code: 'CHM-06',
    question: 'An acid turns blue litmus:',
    options: ['Blue', 'Red', 'Green', 'Colourless'],
    correctIndex: 1,
  },
  {
    code: 'CHM-07',
    question: 'The most abundant gas in Earth’s atmosphere is:',
    options: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Argon'],
    correctIndex: 2,
  },
  {
    code: 'CHM-08',
    question: 'NaCl is an example of a:',
    options: ['Covalent compound', 'Ionic compound', 'Metallic alloy', 'Polymer'],
    correctIndex: 1,
  },
];

const roundLocalQuestions: McqSeed[] = [
  {
    code: 'LOC-01',
    question: 'In this paper’s instructions, how many marks does each MCQ carry unless stated otherwise?',
    options: ['0.5', '1', '2', '4'],
    correctIndex: 1,
  },
  {
    code: 'LOC-02',
    question: 'Negative marking for this round is:',
    options: ['−1 per wrong', '−0.25 per wrong', 'None (demo paper)', '−2 per wrong'],
    correctIndex: 2,
  },
];

const gkQuestions: McqSeed[] = [
  {
    code: 'GK-01',
    question: 'Which planet is known as the Red Planet?',
    options: ['Venus', 'Mars', 'Jupiter', 'Mercury'],
    correctIndex: 1,
  },
  {
    code: 'GK-02',
    question: 'The capital of India is:',
    options: ['Mumbai', 'Kolkata', 'New Delhi', 'Chennai'],
    correctIndex: 2,
  },
  {
    code: 'GK-03',
    question: 'Which gas do plants primarily absorb during photosynthesis?',
    options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'],
    correctIndex: 2,
  },
  {
    code: 'GK-04',
    question: 'Who wrote the national anthem of India?',
    options: [
      'Bankim Chandra Chatterjee',
      'Rabindranath Tagore',
      'Sarojini Naidu',
      'Subhas Chandra Bose',
    ],
    correctIndex: 1,
  },
  {
    code: 'GK-05',
    question: 'The largest desert in the world by area is the:',
    options: ['Gobi', 'Sahara', 'Antarctic', 'Thar'],
    correctIndex: 2,
  },
  {
    code: 'GK-06',
    question: 'Which Indian state is known as the “Land of Five Rivers”?',
    options: ['Punjab', 'Kerala', 'Rajasthan', 'Assam'],
    correctIndex: 0,
  },
  {
    code: 'GK-07',
    question: 'The currency of Japan is the:',
    options: ['Yuan', 'Won', 'Yen', 'Ringgit'],
    correctIndex: 2,
  },
  {
    code: 'GK-08',
    question: 'Which organ purifies blood in the human body?',
    options: ['Heart', 'Liver', 'Kidney', 'Lungs'],
    correctIndex: 2,
  },
];

const quantQuestions: McqSeed[] = [
  {
    code: 'QNT-01',
    question: 'What is 15% of 240?',
    options: ['24', '30', '36', '40'],
    correctIndex: 2,
  },
  {
    code: 'QNT-02',
    question: 'If 3x + 5 = 20, then x =',
    options: ['3', '5', '7', '15'],
    correctIndex: 1,
  },
  {
    code: 'QNT-03',
    question: 'The average of 4, 8, and 12 is:',
    options: ['6', '8', '10', '12'],
    correctIndex: 1,
  },
  {
    code: 'QNT-04',
    question: 'A train covers 120 km in 2 hours. Its average speed is:',
    options: ['40 km/h', '50 km/h', '60 km/h', '80 km/h'],
    correctIndex: 2,
  },
  {
    code: 'QNT-05',
    question: 'Simple interest on ₹1000 at 10% per annum for 2 years is:',
    options: ['₹100', '₹150', '₹200', '₹250'],
    correctIndex: 2,
  },
  {
    code: 'QNT-06',
    question: 'The next number in the series 2, 6, 12, 20, … is:',
    options: ['24', '28', '30', '32'],
    correctIndex: 2,
  },
  {
    code: 'QNT-07',
    question: 'If the ratio of boys to girls is 3:2 and there are 30 boys, girls =',
    options: ['15', '20', '25', '45'],
    correctIndex: 1,
  },
  {
    code: 'QNT-08',
    question: '√144 equals:',
    options: ['10', '11', '12', '14'],
    correctIndex: 2,
  },
];

const draftQuizQuestions: McqSeed[] = [
  {
    code: 'DFT-01',
    question: 'Placeholder: which season follows summer in India?',
    options: ['Spring', 'Monsoon', 'Winter', 'Autumn'],
    correctIndex: 1,
  },
  {
    code: 'DFT-02',
    question: 'Placeholder: 2² equals:',
    options: ['2', '3', '4', '8'],
    correctIndex: 2,
  },
];

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
    email: 'arjun.nair@northstar.demo',
    phone: '+919876510003',
    course: 'JEE',
    city: 'Bengaluru',
    cohort: 'Gamma',
  },
  {
    code: 'BP-24105',
    name: 'Ananya Iyer',
    email: 'ananya.iyer@northstar.demo',
    phone: '+919876510004',
    course: 'NEET',
    city: 'Chennai',
    cohort: 'Beta',
  },
  {
    code: 'BP-24106',
    name: 'Kabir Singh',
    email: 'kabir.singh@northstar.demo',
    phone: '+919876510005',
    course: 'Foundation',
    city: 'Jaipur',
    cohort: 'Alpha',
  },
  {
    code: 'BP-24107',
    name: 'Meera Desai',
    email: 'meera.desai@northstar.demo',
    phone: '+919876510006',
    course: 'JEE',
    city: 'Ahmedabad',
    cohort: 'Gamma',
  },
  {
    code: 'BP-24108',
    name: 'Ishaan Reddy',
    email: 'ishaan.reddy@northstar.demo',
    phone: '+919876510007',
    course: 'NEET',
    city: 'Hyderabad',
    cohort: 'Beta',
  },
  {
    code: 'BP-24109',
    name: 'Diya Sharma',
    email: 'diya.sharma@northstar.demo',
    phone: '+919876510008',
    course: 'Foundation',
    city: 'Lucknow',
    cohort: 'Alpha',
  },
  {
    code: 'BP-24110',
    name: 'Vivaan Joshi',
    email: 'vivaan.joshi@northstar.demo',
    phone: '+919876510009',
    course: 'JEE',
    city: 'Indore',
    cohort: 'Gamma',
  },
  {
    code: 'BP-24111',
    name: 'Aisha Begum',
    email: 'aisha.begum@northstar.demo',
    phone: '+919876510010',
    course: 'NEET',
    city: 'Kolkata',
    cohort: 'Beta',
  },
  {
    code: 'BP-24112',
    name: 'Neil Kapoor',
    email: 'neil.kapoor@northstar.demo',
    phone: '+919876510011',
    course: 'JEE',
    city: 'Chandigarh',
    cohort: 'Gamma',
  },
];

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 12);

  const org = await prisma.organization.upsert({
    where: { slug: 'demo' },
    update: { name: 'Northstar Prep', isActive: true },
    create: {
      name: 'Northstar Prep',
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
    update: { passwordHash, name: 'Meera Joshi', isActive: true },
    create: {
      email: 'admin@brainpulses.com',
      name: 'Meera Joshi',
      passwordHash,
    },
  });

  const viewOnly = await prisma.user.upsert({
    where: { email: 'viewer@brainpulses.com' },
    update: { passwordHash, name: 'Aryan Verma', isActive: true },
    create: {
      email: 'viewer@brainpulses.com',
      name: 'Aryan Verma',
      passwordHash,
    },
  });

  await prisma.membership.upsert({
    where: {
      organizationId_userId: { organizationId: org.id, userId: admin.id },
    },
    update: { role: 'super_admin', assessmentAccess: 'full', quizAccess: 'full', isActive: true },
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
    update: { role: 'admin', assessmentAccess: 'full', quizAccess: 'full', isActive: true },
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
    update: { assessmentAccess: 'view', quizAccess: 'view', isActive: true },
    create: {
      organizationId: org.id,
      userId: viewOnly.id,
      role: 'admin',
      assessmentAccess: 'view',
      quizAccess: 'view',
    },
  });

  await wipeDemoDomain(org.id);

  const students = [];
  for (const row of studentRoster) {
    const student = await prisma.student.create({
      data: {
        organizationId: org.id,
        code: row.code,
        name: row.name,
        email: row.email,
        phone: row.phone,
        course: row.course,
        city: row.city,
        cohort: row.cohort,
        isActive: true,
        lastLoginAt: row.code === 'BP-24101' ? hoursAgo(2) : daysAgo(1 + (students.length % 5)),
      },
    });
    students.push(student);
  }
  const studentIds = students.map((s) => s.id);
  const byCode = Object.fromEntries(students.map((s) => [s.code, s]));

  const physicsBank = await ensureBankWithQuestions({
    organizationId: org.id,
    kind: 'assessment',
    code: 'QB-26001',
    name: 'Physics — Mechanics & Laws',
    description: 'JEE-oriented mechanics, work–energy, and basic electricity MCQs.',
    questions: physicsQuestions,
  });

  const chemistryBank = await ensureBankWithQuestions({
    organizationId: org.id,
    kind: 'assessment',
    code: 'QB-26003',
    name: 'Chemistry — Foundations',
    description: 'Stoichiometry, acids–bases, and everyday chemistry for NEET/JEE.',
    questions: chemistryQuestions,
  });

  const gkBank = await ensureBankWithQuestions({
    organizationId: org.id,
    kind: 'quiz',
    code: 'QB-26002',
    name: 'Weekly General Knowledge',
    description: 'Current affairs–style GK for weekly practice sessions.',
    questions: gkQuestions,
  });

  const quantBank = await ensureBankWithQuestions({
    organizationId: org.id,
    kind: 'quiz',
    code: 'QB-26004',
    name: 'Quantitative Aptitude Sprint',
    description: 'Percentages, averages, ratios, and number series.',
    questions: quantQuestions,
  });

  // Draft bank for admin status filters only — never linked to a published activity.
  const draftBank = await ensureBankWithQuestions({
    organizationId: org.id,
    kind: 'quiz',
    code: 'QB-DRAFT',
    name: 'Seasonal Warm-up',
    description: 'Work-in-progress question bank for authoring demos.',
    questions: draftQuizQuestions,
    status: 'draft',
  });

  // Assessment ASM-26001 — two rounds
  const assessment = await prisma.activity.create({
    data: {
      organizationId: org.id,
      kind: 'assessment',
      code: 'ASM-26001',
      name: 'Northstar JEE Mock — April Cycle',
      subtitle: 'Engineering · Full mock with two timed rounds',
      status: 'active',
      startsAt: daysAgo(3),
      endsAt: daysFromNow(21),
      durationMinutes: 90,
      passingPercent: 40,
      presentation: 'one_at_a_time',
    },
  });

  const round1 = await prisma.activityRound.create({
    data: {
      organizationId: org.id,
      activityId: assessment.id,
      name: 'Round 1 — Physics',
      sortOrder: 0,
      durationMinutes: 45,
    },
  });
  await prisma.activityRoundBank.create({
    data: {
      organizationId: org.id,
      roundId: round1.id,
      bankId: physicsBank.id,
    },
  });

  const localBank = await ensureBankWithQuestions({
    organizationId: org.id,
    kind: 'assessment',
    code: `RL-${assessment.code}-R2`,
    name: 'Round 2 local instructions',
    description: 'Round-local items for Chemistry paper.',
    questions: roundLocalQuestions,
    origin: 'round_local',
  });

  const round2 = await prisma.activityRound.create({
    data: {
      organizationId: org.id,
      activityId: assessment.id,
      name: 'Round 2 — Chemistry',
      sortOrder: 1,
      durationMinutes: 45,
      localBankId: localBank.id,
    },
  });
  await prisma.activityRoundBank.create({
    data: {
      organizationId: org.id,
      roundId: round2.id,
      bankId: chemistryBank.id,
    },
  });

  await registerStudents(org.id, assessment.id, studentIds);

  // Quiz QZ-26001 — weekly GK (active, boards on)
  const weeklyGk = await prisma.activity.create({
    data: {
      organizationId: org.id,
      kind: 'quiz',
      code: 'QZ-26001',
      name: 'Weekly General Knowledge',
      subtitle: 'General knowledge · Week 16 practice',
      status: 'active',
      startsAt: daysAgo(2),
      endsAt: daysFromNow(12),
      durationMinutes: 15,
      passingPercent: 50,
      presentation: 'one_at_a_time',
      settings: quizBehaviourSettings,
    },
  });
  await prisma.activityBank.create({
    data: { organizationId: org.id, activityId: weeklyGk.id, bankId: gkBank.id },
  });
  await registerStudents(org.id, weeklyGk.id, studentIds);

  // Quiz QZ-26002 — quant (completed window)
  const quantQuiz = await prisma.activity.create({
    data: {
      organizationId: org.id,
      kind: 'quiz',
      code: 'QZ-26002',
      name: 'Maths Sprint #12',
      subtitle: 'Quantitative aptitude · Timed quiz',
      status: 'completed',
      startsAt: daysAgo(14),
      endsAt: daysAgo(1),
      durationMinutes: 20,
      passingPercent: 50,
      presentation: 'one_at_a_time',
      settings: {
        quiz: {
          ...quizBehaviourSettings.quiz,
          scoreVisibleToStudent: true,
          answersVisibleToStudent: false,
        },
      },
    },
  });
  await prisma.activityBank.create({
    data: { organizationId: org.id, activityId: quantQuiz.id, bankId: quantBank.id },
  });
  await registerStudents(org.id, quantQuiz.id, studentIds);

  // Draft quiz for admin status filters only.
  // Copy must not encode workflow status — `status` is the source of truth.
  // Never register students: drafts must not appear in the student portal.
  const draftQuiz = await prisma.activity.create({
    data: {
      organizationId: org.id,
      kind: 'quiz',
      code: 'QZ-DRAFT',
      name: 'Monsoon Warm-up Quiz',
      subtitle: 'Short seasonal warm-up · monsoon practice set',
      status: 'draft',
      startsAt: null,
      endsAt: null,
      durationMinutes: 10,
      passingPercent: 40,
      settings: quizBehaviourSettings,
    },
  });
  await prisma.activityBank.create({
    data: { organizationId: org.id, activityId: draftQuiz.id, bankId: draftBank.id },
  });
  const draftRegs = await prisma.registration.count({ where: { activityId: draftQuiz.id } });
  if (draftRegs > 0) {
    throw new Error('Seed invariant: QZ-DRAFT must have zero student registrations.');
  }

  // Archived assessment for admin status filters only (no student registrations).
  await prisma.activity.create({
    data: {
      organizationId: org.id,
      kind: 'assessment',
      code: 'ASM-ARCHIVE',
      name: 'Foundation Checkpoint — Jan',
      subtitle: 'January cycle · foundation checkpoint',
      status: 'archived',
      startsAt: daysAgo(60),
      endsAt: daysAgo(45),
      durationMinutes: 60,
      passingPercent: 35,
    },
  });

  // ─── History: weekly GK results (skip BP-24101 so they can still start) ───
  const gkVersions = await latestVersionIds(org.id, gkBank.id);
  const gkIds = gkVersions.map((v) => v.id);

  const gkHistory: {
    code: string;
    correct: number;
    release: ReleaseStatus;
    hoursAgoSubmit: number;
    dq?: boolean;
  }[] = [
    { code: 'BP-24102', correct: 7, release: 'published', hoursAgoSubmit: 20 },
    { code: 'BP-24103', correct: 5, release: 'published', hoursAgoSubmit: 18 },
    { code: 'BP-24104', correct: 8, release: 'published', hoursAgoSubmit: 16 },
    { code: 'BP-24105', correct: 4, release: 'published', hoursAgoSubmit: 14 },
    { code: 'BP-24106', correct: 6, release: 'withheld', hoursAgoSubmit: 10 },
    { code: 'BP-24107', correct: 3, release: 'published', hoursAgoSubmit: 8, dq: true },
    { code: 'BP-24108', correct: 7, release: 'published', hoursAgoSubmit: 6 },
    { code: 'BP-24109', correct: 5, release: 'published', hoursAgoSubmit: 4 },
  ];

  for (const row of gkHistory) {
    const student = byCode[row.code]!;
    const submittedAt = hoursAgo(row.hoursAgoSubmit);
    await seedSubmittedAttempt({
      organizationId: org.id,
      activityId: weeklyGk.id,
      studentId: student.id,
      versionIds: gkIds,
      correctCount: row.correct,
      releaseStatus: row.release,
      submittedAt,
      startedAt: new Date(submittedAt.getTime() - 12 * 60_000),
      deadlineAt: new Date(submittedAt.getTime() + 3 * 60_000),
      disqualified: row.dq,
      disqualifiedByUserId: row.dq ? admin.id : undefined,
    });
  }

  await prisma.reattemptGrant.create({
    data: {
      organizationId: org.id,
      activityId: weeklyGk.id,
      studentId: byCode['BP-24105']!.id,
      mode: 'restart',
      note: 'Network dropout during last minute — restart granted.',
      grantedByUserId: admin.id,
    },
  });

  // Quant quiz history (completed activity)
  const quantVersions = await latestVersionIds(org.id, quantBank.id);
  const quantIds = quantVersions.map((v) => v.id);
  const quantHistoryCodes = ['BP-24102', 'BP-24103', 'BP-24104', 'BP-24110', 'BP-24111'] as const;
  for (let i = 0; i < quantHistoryCodes.length; i += 1) {
    const code = quantHistoryCodes[i]!;
    const student = byCode[code]!;
    const submittedAt = daysAgo(3 - (i % 3));
    await seedSubmittedAttempt({
      organizationId: org.id,
      activityId: quantQuiz.id,
      studentId: student.id,
      versionIds: quantIds,
      correctCount: 4 + (i % 4),
      releaseStatus: 'published',
      submittedAt,
      startedAt: new Date(submittedAt.getTime() - 18 * 60_000),
      deadlineAt: new Date(submittedAt.getTime() + 2 * 60_000),
    });
  }

  // Assessment: one student finished Round 1 (not Priya)
  const physicsVersions = await latestVersionIds(org.id, physicsBank.id);
  const physicsIds = physicsVersions.map((v) => v.id);
  const round1Submit = daysAgo(1);
  await seedSubmittedAttempt({
    organizationId: org.id,
    activityId: assessment.id,
    studentId: byCode['BP-24102']!.id,
    roundId: round1.id,
    versionIds: physicsIds,
    correctCount: 8,
    releaseStatus: 'published',
    submittedAt: round1Submit,
    startedAt: new Date(round1Submit.getTime() - 40 * 60_000),
    deadlineAt: new Date(round1Submit.getTime() + 5 * 60_000),
  });

  // Org polish
  await prisma.setting.createMany({
    data: [
      {
        organizationId: org.id,
        group: 'general',
        key: 'orgDisplayName',
        value: 'Northstar Prep',
      },
      {
        organizationId: org.id,
        group: 'general',
        key: 'organizationName',
        value: 'Northstar Prep Learning Pvt. Ltd.',
      },
      {
        organizationId: org.id,
        group: 'system',
        key: 'supportEmail',
        value: 'support@northstar.demo',
      },
      {
        organizationId: org.id,
        group: 'notifications',
        key: 'quizCompletion',
        value: true,
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        organizationId: org.id,
        eventType: 'quiz.completed',
        title: 'Maths Sprint #12 closed',
        body: 'Window ended. Results are available in Reports.',
        createdAt: daysAgo(1),
      },
      {
        organizationId: org.id,
        eventType: 'assessment.published',
        title: 'JEE Mock April cycle is live',
        body: 'Students can start Round 1 — Physics.',
        createdAt: daysAgo(3),
      },
      {
        organizationId: org.id,
        eventType: 'leaderboard.updated',
        title: 'Weekly GK standings updated',
        body: 'Cohort Alpha leads the group board after today’s submissions.',
        createdAt: hoursAgo(4),
      },
    ],
  });

  await prisma.auditEvent.createMany({
    data: [
      {
        organizationId: org.id,
        actorType: 'user',
        actorUserId: admin.id,
        action: 'activity.publish',
        targetType: 'activity',
        targetId: weeklyGk.id,
        metadata: { code: 'QZ-26001' },
        createdAt: daysAgo(2),
      },
      {
        organizationId: org.id,
        actorType: 'user',
        actorUserId: admin.id,
        action: 'attempt.disqualify',
        targetType: 'attempt',
        metadata: { studentCode: 'BP-24107', note: 'Seed invigilation flag' },
        createdAt: hoursAgo(8),
      },
      {
        organizationId: org.id,
        actorType: 'system',
        action: 'seed.completed',
        targetType: 'organization',
        targetId: org.id,
        metadata: { narrative: 'northstar-prep' },
      },
    ],
  });

  // Cross-tenant student for tenancy tests
  await prisma.student.upsert({
    where: {
      organizationId_code: { organizationId: orgB.id, code: 'BP-99001' },
    },
    update: { isActive: true, name: 'Other Student', email: 'other.student@mail.com' },
    create: {
      organizationId: orgB.id,
      code: 'BP-99001',
      name: 'Other Student',
      email: 'other.student@mail.com',
    },
  });

  console.log('Seed complete — Northstar Prep (slug: demo).');
  console.log('  admin@brainpulses.com / Password123!');
  console.log('  viewer@brainpulses.com / Password123! (view-only)');
  console.log('  Student Unique ID: BP-24101 (phone +91 / 9876510000)');
  console.log('  Activities: ASM-26001 (2 rounds), QZ-26001, QZ-26002, QZ-DRAFT, ASM-ARCHIVE');
  console.log('  History: quiz results + 1 assessment round attempt (Priya has open path)');
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
