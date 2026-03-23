import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { UserRole } from '@prisma/client';

import { prisma } from '@/lib/prisma';

const DEFAULT_ADMIN_EMAIL = 'admin@stockpilot.com';
const DEFAULT_ADMIN_NAME = 'System Administrator';
const DEFAULT_ADMIN_PASSWORD = '123456';

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, passwordHash: string) {
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

export async function ensureDefaultAdminUser() {
  const passwordHash = hashPassword(DEFAULT_ADMIN_PASSWORD);

  return prisma.adminUser.upsert({
    where: { email: DEFAULT_ADMIN_EMAIL },
    update: {
      name: DEFAULT_ADMIN_NAME,
      role: UserRole.ADMIN,
    },
    create: {
      name: DEFAULT_ADMIN_NAME,
      email: DEFAULT_ADMIN_EMAIL,
      passwordHash,
      role: UserRole.ADMIN,
    },
  });
}

export async function verifyAdminCredentials(email: string, password: string) {
  await ensureDefaultAdminUser();
  const user = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user) {
    return null;
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return null;
  }

  return user;
}
