import '../src/config/load-env.js';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';

const hash = await bcrypt.hash('Password123!', 10);
const viewer = await prisma.user.upsert({
  where: { email: 'viewer@brainpulses.com' },
  update: { passwordHash: hash, mustChangePassword: false, isActive: true },
  create: { email: 'viewer@brainpulses.com', name: 'Aryan Verma', passwordHash: hash },
});
const orgs = await prisma.organization.findMany();
for (const org of orgs) {
  await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: viewer.id } },
    update: { isActive: true, assessmentAccess: 'view', quizAccess: 'view', role: 'admin' },
    create: {
      organizationId: org.id,
      userId: viewer.id,
      role: 'admin',
      assessmentAccess: 'view',
      quizAccess: 'view',
      isActive: true,
    },
  });
}
console.log('viewer ready', viewer.id, 'orgs', orgs.length);
await prisma.$disconnect();
