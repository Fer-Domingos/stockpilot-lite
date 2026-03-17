'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authConfig } from '@/lib/session';

export async function logoutAction() {
  cookies().set(authConfig.sessionCookieName, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/'
  });

  redirect('/login');
}
