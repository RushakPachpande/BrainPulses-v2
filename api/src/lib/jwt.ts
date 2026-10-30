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
  /** When true, only password-change / session routes are allowed. */
  mustChangePassword?: boolean;
  /** Password epoch; tokens with a lower value are rejected after a password write. */
  pwdEpoch?: number;
};

export type StudentAccessTokenPayload = {
  typ: 'student';
  sub: string;
  organizationId: string;
  sid: string;
};

export type OrgSelectTokenPayload = {
  typ: 'org_select';
  sub: string;
};

type AnyPayload = AccessTokenPayload | StudentAccessTokenPayload | OrgSelectTokenPayload;

const signOptions = (): jwt.SignOptions => ({
  algorithm: 'HS256',
  issuer: env.JWT_ISSUER,
  audience: env.JWT_AUDIENCE,
});

const verifyOptions = (): jwt.VerifyOptions => ({
  algorithms: ['HS256'],
  issuer: env.JWT_ISSUER,
  audience: env.JWT_AUDIENCE,
});

export function signAccessToken(payload: Omit<AccessTokenPayload, 'typ'>): string {
  return jwt.sign(
    { ...payload, typ: 'access' satisfies AccessTokenPayload['typ'] },
    env.JWT_SECRET,
    {
      ...signOptions(),
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    },
  );
}

export function signStudentAccessToken(payload: Omit<StudentAccessTokenPayload, 'typ'>): string {
  return jwt.sign(
    { ...payload, typ: 'student' satisfies StudentAccessTokenPayload['typ'] },
    env.JWT_SECRET,
    {
      ...signOptions(),
      expiresIn: env.STUDENT_JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    },
  );
}

export function signOrgSelectToken(userId: string): string {
  return jwt.sign(
    { typ: 'org_select' satisfies OrgSelectTokenPayload['typ'], sub: userId },
    env.JWT_SECRET,
    {
      ...signOptions(),
      expiresIn: env.JWT_ORG_SELECT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    },
  );
}

export function verifyToken(token: string): AnyPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, verifyOptions());
  if (typeof decoded !== 'object' || decoded === null || !('typ' in decoded)) {
    throw new Error('Invalid token payload');
  }
  return decoded as AnyPayload;
}
