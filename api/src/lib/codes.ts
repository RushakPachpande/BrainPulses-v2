import { prisma } from './prisma.js';

type Prefix = 'BP' | 'ASM' | 'QUZ' | 'QB' | 'Q';

export async function nextHumanCode(
  organizationId: string,
  prefix: Prefix,
  kind: 'student' | 'activity' | 'bank' | 'question',
): Promise<string> {
  const year = new Date().getFullYear() % 100;
  const base = `${prefix}-${year}`;

  let latest: string | null = null;
  if (kind === 'student') {
    const row = await prisma.student.findFirst({
      where: { organizationId, code: { startsWith: `${prefix}-` } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    latest = row?.code ?? null;
  } else if (kind === 'activity') {
    const row = await prisma.activity.findFirst({
      where: { organizationId, code: { startsWith: `${prefix}-` } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    latest = row?.code ?? null;
  } else if (kind === 'bank') {
    const row = await prisma.questionBank.findFirst({
      where: { organizationId, code: { startsWith: `${prefix}-` } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    latest = row?.code ?? null;
  }

  let seq = 1;
  if (latest) {
    const match = latest.match(/-(\d+)$/);
    if (match?.[1]) seq = Number(match[1]) + 1;
  }

  if (kind === 'student') {
    return `${prefix}-${24000 + seq}`;
  }
  return `${base}${String(seq).padStart(3, '0')}`;
}
