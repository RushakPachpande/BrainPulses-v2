import { prisma } from './src/lib/prisma.js';

const assignments = await prisma.registration.findMany({
  select: { activity: { select: { name: true, kind: true } }, participant: { select: { name: true, code: true } } },
});
console.log(JSON.stringify({
  forms: await prisma.contestRegistrationForm.count(),
  submissions: await prisma.contestFormSubmission.count(),
  assignments,
}, null, 2));
await prisma.$disconnect();
