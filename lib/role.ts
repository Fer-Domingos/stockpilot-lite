import { cookies } from 'next/headers';

import { AppRole } from '@/lib/demo-data';
import { authConfig, decodeSession } from '@/lib/session';

export function normalizeRole(roleValue?: string | null): AppRole {
  return roleValue === 'PM' ? 'PM' : 'ADMIN';
}

export async function getRole(roleValue?: string): Promise<AppRole> {
  const sessionToken = cookies().get(authConfig.sessionCookieName)?.value;
  const session = await decodeSession(sessionToken);

  if (session?.role) {
    return normalizeRole(session.role);
  }

  return normalizeRole(roleValue);
}
