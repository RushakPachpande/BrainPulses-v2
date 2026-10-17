import type { AccessLevel, MembershipRole } from '#prisma';

export type AuthActor =
  | {
      kind: 'user';
      userId: string;
      organizationId: string;
      membershipId: string;
      role: MembershipRole;
      assessmentAccess: AccessLevel;
      quizAccess: AccessLevel;
    }
  | {
      kind: 'student';
      studentId: string;
      organizationId: string;
      sessionId: string;
    };
