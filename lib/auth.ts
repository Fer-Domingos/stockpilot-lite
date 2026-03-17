import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';

const ADMIN_EMAIL = 'admin@stockpilot.com';
const ADMIN_PASSWORD = '123456';
const SESSION_COOKIE = 'stockpilot_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

type SessionPayload = {
  email: string;
  issuedAt: number;
};

function getAuthSecret() {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? 'stockpilot-lite-default-auth-secret';
}

function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, passwordHash: string) {
  const [salt, storedHash] = passwordHash.split(':');
  if (!salt || !storedHash) {
    return false;
  }

  const candidate = scryptSync(password, salt, 64);
  const stored = Buffer.from(storedHash, 'hex');

  if (candidate.length !== stored.length) {
    return false;
  }

  return timingSafeEqual(candidate, stored);
}

function sign(value: string) {
  return createHmac('sha256', getAuthSecret()).update(value).digest('hex');
}

export function encodeSession(payload: SessionPayload) {
  const base = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(base);
  return `${base}.${signature}`;
}

export function decodeSession(token?: string) {
  if (!token) {
    return null;
  }

  const [base, signature] = token.split('.');
  if (!base || !signature) {
    return null;
  }

  const expected = sign(base);
  if (expected.length !== signature.length) {
    return null;
  }

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (!timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(base, 'base64url').toString('utf8')) as SessionPayload;
    const isExpired = Date.now() - payload.issuedAt > SESSION_MAX_AGE_SECONDS * 1000;

    if (!payload.email || isExpired) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function ensureDefaultAdminUser() {
  const passwordHash = hashPassword(ADMIN_PASSWORD);

  return prisma.adminUser.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      passwordHash
    }
  });
}

export async function verifyAdminCredentials(email: string, password: string) {
  await ensureDefaultAdminUser();
  const user = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase().trim() } });

  if (!user) {
    return null;
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return null;
  }

  return user;
}

export const authConfig = {
  adminEmail: ADMIN_EMAIL,
  adminPassword: ADMIN_PASSWORD,
  sessionCookieName: SESSION_COOKIE,
  sessionMaxAgeSeconds: SESSION_MAX_AGE_SECONDS
};
