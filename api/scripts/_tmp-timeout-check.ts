import { prisma, disconnectPrisma } from '../src/lib/prisma.ts';

const statement = await prisma.$queryRawUnsafe('SHOW statement_timeout');
const idle = await prisma.$queryRawUnsafe('SHOW idle_in_transaction_session_timeout');
console.log(JSON.stringify({ statement, idle }));
await disconnectPrisma();
