import '../src/config/load-env.js';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';

const hash = await bcrypt.hash('Password123!', 10);
const r = await prisma.user.updateMany({
  where: {
    email: {
      in: ['viewer@brainpulses.com', 'admin@brainpulses.com', 'superadmin@brainpulses.com'],
    },
  },
  data: { passwordHash: hash, mustChangePassword: false },
});
console.log('updated users', r.count);
await prisma.$disconnect();
