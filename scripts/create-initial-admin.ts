import { randomBytes, scryptSync } from 'crypto';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function validatePassword(password: string) {
  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters long.');
  }
}

function assertSafeDatabaseTarget() {
  const databaseUrl = getRequiredEnv('DATABASE_URL');
  const expectedDatabaseToken = getRequiredEnv('CMD_DATABASE_GUARD');

  if (!databaseUrl.includes(expectedDatabaseToken)) {
    throw new Error(
      `Safety check failed: DATABASE_URL does not include CMD_DATABASE_GUARD token "${expectedDatabaseToken}".`,
    );
  }
}

async function main() {
  assertSafeDatabaseTarget();

  const email = getRequiredEnv('ADMIN_EMAIL').toLowerCase();
  const password = getRequiredEnv('ADMIN_PASSWORD');
  const name = process.env.ADMIN_NAME?.trim() || 'CMD Administrator';

  validatePassword(password);

  const existingAdminCount = await prisma.adminUser.count();
  if (existingAdminCount > 0) {
    throw new Error(
      'Admin users already exist. Refusing to create initial admin because this command is intended for first-time bootstrap only.',
    );
  }

  await prisma.adminUser.create({
    data: {
      name,
      email,
      passwordHash: hashPassword(password),
      role: UserRole.ADMIN,
    },
  });

  console.log(`Initial ADMIN user created for ${email}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
