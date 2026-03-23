'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { UserRole } from '@prisma/client';

import { hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { authConfig, decodeSession } from '@/lib/session';

export type UserManagementResult = {
  ok: boolean;
  error?: string;
};

async function requireAdmin() {
  const sessionToken = cookies().get(authConfig.sessionCookieName)?.value;
  const session = await decodeSession(sessionToken);

  if (!session || session.role !== 'ADMIN') {
    throw new Error('You are not authorized to perform this action.');
  }
}

export async function createUserAction(
  _prevState: UserManagementResult,
  formData: FormData,
): Promise<UserManagementResult> {
  await requireAdmin();

  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').toLowerCase().trim();
  const password = String(formData.get('password') ?? '');
  const role = String(formData.get('role') ?? 'PM') === 'ADMIN' ? UserRole.ADMIN : UserRole.PM;

  if (!name || !email || !password) {
    return { ok: false, error: 'Name, email, and password are required.' };
  }

  if (password.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters.' };
  }

  const existingUser = await prisma.adminUser.findUnique({ where: { email } });

  if (existingUser) {
    return { ok: false, error: 'A user with that email already exists.' };
  }

  await prisma.adminUser.create({
    data: {
      name,
      email,
      passwordHash: hashPassword(password),
      role,
    },
  });

  revalidatePath('/users');
  return { ok: true };
}
