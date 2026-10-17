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
    // Student codes are BP-24NNN (offset form); sequence is the trailing digits after BP-.
    const row = await prisma.student.findFirst({
      where: { organizationId, code: { startsWith: `${prefix}-` } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    latest = row?.code ?? null;
  } else if (kind === 'activity') {
    const row = await prisma.activity.findFirst({
      where: { organizationId, code: { startsWith: base } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    latest = row?.code ?? null;
  } else if (kind === 'bank') {
    const row = await prisma.questionBank.findFirst({
      where: { organizationId, code: { startsWith: base } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    latest = row?.code ?? null;
  }

  let seq = 1;
  if (latest) {
    if (kind === 'student') {
      const match = latest.match(/^[A-Z]+-(\d+)$/);
      if (match?.[1]) {
        const n = Number(match[1]);
        // Stored as 24000+seq historically; recover seq from absolute number.
        seq = n >= 24_000 ? n - 24_000 + 1 : n + 1;
      }
    } else {
      // Only the sequence after the current-year base (e.g. ASM-26001 → 1).
      if (latest.startsWith(base)) {
        const seqPart = latest.slice(base.length);
        const n = Number(seqPart);
        if (Number.isFinite(n)) seq = n + 1;
      }
    }
  }

  if (kind === 'student') {
    return `${prefix}-${24000 + seq}`;
  }
  return `${base}${String(seq).padStart(3, '0')}`;
}
