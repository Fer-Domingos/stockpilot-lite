'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAdminCredentials } from '@/lib/auth';
import { authConfig, encodeSession, getSessionCookieOptions } from '@/lib/session';

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const user = await verifyAdminCredentials(email, password);

  if (!user) {
    redirect('/login?error=invalid_credentials');
  }

  cookies().set(
    authConfig.sessionCookieName,
    await encodeSession({ email: user.email, issuedAt: Date.now() }),
    getSessionCookieOptions()
  );

  redirect('/dashboard');
}
