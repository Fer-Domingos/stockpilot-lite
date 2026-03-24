'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { hashPassword, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { authConfig, decodeSession } from '@/lib/session';

export type ChangePasswordResult = {
  ok: boolean;
  error?: string;
};

async function requireSessionUser() {
  const sessionToken = cookies().get(authConfig.sessionCookieName)?.value;
  const session = await decodeSession(sessionToken);

  if (!session) {
    throw new Error('You are not authorized to perform this action.');
  }

  return session;
}

export async function changePasswordAction(
  _prevState: ChangePasswordResult,
  formData: FormData,
): Promise<ChangePasswordResult> {
  const session = await requireSessionUser();

  const currentPassword = String(formData.get('currentPassword') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');
  const confirmNewPassword = String(formData.get('confirmNewPassword') ?? '');

  if (!currentPassword || !newPassword || !confirmNewPassword) {
    return { ok: false, error: 'All password fields are required.' };
  }

  if (newPassword.length < 8) {
    return { ok: false, error: 'New password must be at least 8 characters.' };
  }

  if (newPassword !== confirmNewPassword) {
    return { ok: false, error: 'New password confirmation does not match.' };
  }

  if (currentPassword === newPassword) {
    return { ok: false, error: 'New password must be different from current password.' };
  }

  const user = await prisma.adminUser.findUnique({
    where: { email: session.email.toLowerCase().trim() },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    return { ok: false, error: 'Unable to find your user account.' };
  }

  if (!verifyPassword(currentPassword, user.passwordHash)) {
    return { ok: false, error: 'Current password is incorrect.' };
  }

  await prisma.adminUser.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(newPassword) },
  });

  revalidatePath('/account');
  return { ok: true };
}
