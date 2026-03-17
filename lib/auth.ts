import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';

const ADMIN_EMAIL = 'admin@stockpilot.com';
const ADMIN_PASSWORD = '123456';

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
