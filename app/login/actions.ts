'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authConfig, encodeSession, verifyAdminCredentials } from '@/lib/auth';

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const user = await verifyAdminCredentials(email, password);

  if (!user) {
    redirect('/login?error=invalid_credentials');
  }

  cookies().set(authConfig.sessionCookieName, encodeSession({ email: user.email, issuedAt: Date.now() }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: authConfig.sessionMaxAgeSeconds,
    path: '/'
  });

  redirect('/dashboard');
}
