'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAdminCredentials } from '@/lib/auth';
import { authConfig, encodeSession, SessionRole } from '@/lib/session';

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const role = String(formData.get('role') ?? 'ADMIN') === 'PM' ? 'PM' : 'ADMIN';

  const user = await verifyAdminCredentials(email, password);

  if (!user) {
    redirect('/login?error=invalid_credentials');
  }

  cookies().set(authConfig.sessionCookieName, await encodeSession({ email: user.email, issuedAt: Date.now(), role: role as SessionRole }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: authConfig.sessionMaxAgeSeconds,
    path: '/'
  });

  redirect('/dashboard');
}
