'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { UserRole } from '@prisma/client';

import { hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { authConfig, decodeSession } from '@/lib/session';

const CORE_SYSTEM_ADMIN_EMAIL = 'admin@stockpilot.com';

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

  return session;
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

  if (password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
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

export async function updateUserRoleAction(
  _prevState: UserManagementResult,
  formData: FormData,
): Promise<UserManagementResult> {
  const session = await requireAdmin();

  const userId = String(formData.get('userId') ?? '').trim();
  const roleInput = String(formData.get('role') ?? '').trim();
  const role = roleInput === 'ADMIN' ? UserRole.ADMIN : roleInput === 'PM' ? UserRole.PM : null;

  if (!userId || !role) {
    return { ok: false, error: 'User and role are required.' };
  }

  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });

  if (!user) {
    return { ok: false, error: 'User not found.' };
  }

  if (user.role === role) {
    return { ok: true };
  }

  if (user.email === CORE_SYSTEM_ADMIN_EMAIL && role !== UserRole.ADMIN) {
    return { ok: false, error: 'The seeded system admin must remain an admin.' };
  }

  if (user.email === session.email && role !== UserRole.ADMIN) {
    return { ok: false, error: 'You cannot remove your own admin access.' };
  }

  if (user.role === UserRole.ADMIN && role !== UserRole.ADMIN) {
    const adminCount = await prisma.adminUser.count({ where: { role: UserRole.ADMIN } });
    if (adminCount <= 1) {
      return { ok: false, error: 'At least one admin account must remain.' };
    }
  }

  await prisma.adminUser.update({
    where: { id: userId },
    data: { role },
  });

  revalidatePath('/users');
  return { ok: true };
}

export async function deleteUserAction(
  _prevState: UserManagementResult,
  formData: FormData,
): Promise<UserManagementResult> {
  const session = await requireAdmin();

  const userId = String(formData.get('userId') ?? '').trim();
  if (!userId) {
    return { ok: false, error: 'User is required.' };
  }

  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });

  if (!user) {
    return { ok: false, error: 'User not found.' };
  }

  if (user.email === session.email) {
    return { ok: false, error: 'You cannot remove your own account.' };
  }

  if (user.email === CORE_SYSTEM_ADMIN_EMAIL) {
    return { ok: false, error: 'The seeded system admin cannot be removed.' };
  }

  if (user.role === UserRole.ADMIN) {
    const adminCount = await prisma.adminUser.count({ where: { role: UserRole.ADMIN } });
    if (adminCount <= 1) {
      return { ok: false, error: 'At least one admin account must remain.' };
    }
  }

  await prisma.adminUser.delete({ where: { id: userId } });

  revalidatePath('/users');
  return { ok: true };
}

export async function resetPasswordAction(
  _prevState: UserManagementResult,
  formData: FormData,
): Promise<UserManagementResult> {
  await requireAdmin();

  const userId = String(formData.get('userId') ?? '').trim();
  const temporaryPassword = String(formData.get('temporaryPassword') ?? '');
  const confirmTemporaryPassword = String(formData.get('confirmTemporaryPassword') ?? '');

  if (!userId || !temporaryPassword || !confirmTemporaryPassword) {
    return { ok: false, error: 'User and both password fields are required.' };
  }

  if (temporaryPassword.length < 8) {
    return { ok: false, error: 'Temporary password must be at least 8 characters.' };
  }

  if (temporaryPassword !== confirmTemporaryPassword) {
    return { ok: false, error: 'Passwords do not match' };
  }

  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    return { ok: false, error: 'User not found.' };
  }

  await prisma.adminUser.update({
    where: { id: userId },
    data: { passwordHash: hashPassword(temporaryPassword) },
  });

  revalidatePath('/users');
  return { ok: true };
}
