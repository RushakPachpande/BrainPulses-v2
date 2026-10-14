import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { AccessLevel, MembershipRole } from '#prisma';

export type AccessTokenPayload = {
  typ: 'access';
  sub: string;
  organizationId: string;
  membershipId: string;
  role: MembershipRole;
  assessmentAccess: AccessLevel;
  quizAccess: AccessLevel;
};

export type StudentAccessTokenPayload = {
  typ: 'student';
  sub: string;
  organizationId: string;
};

export type OrgSelectTokenPayload = {
  typ: 'org_select';
  sub: string;
};

type AnyPayload = AccessTokenPayload | StudentAccessTokenPayload | OrgSelectTokenPayload;

export function signAccessToken(payload: Omit<AccessTokenPayload, 'typ'>): string {
  return jwt.sign(
    { ...payload, typ: 'access' satisfies AccessTokenPayload['typ'] },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    },
  );
}

export function signStudentAccessToken(payload: Omit<StudentAccessTokenPayload, 'typ'>): string {
  return jwt.sign(
    { ...payload, typ: 'student' satisfies StudentAccessTokenPayload['typ'] },
    env.JWT_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
  );
}

export function signOrgSelectToken(userId: string): string {
  return jwt.sign(
    { typ: 'org_select' satisfies OrgSelectTokenPayload['typ'], sub: userId },
    env.JWT_SECRET,
    { expiresIn: env.JWT_ORG_SELECT_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
  );
}

export function verifyToken(token: string): AnyPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded !== 'object' || decoded === null || !('typ' in decoded)) {
    throw new Error('Invalid token payload');
  }
  return decoded as AnyPayload;
}
