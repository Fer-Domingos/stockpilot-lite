import { redirect } from 'next/navigation';

import { ChangePasswordForm } from '@/app/account/change-password-form';
import { AppShell } from '@/app/components/app-shell';
import { prisma } from '@/lib/prisma';
import { getRole } from '@/lib/role';
import { authConfig, decodeSession } from '@/lib/session';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const role = await getRole();
  const sessionToken = cookies().get(authConfig.sessionCookieName)?.value;
  const session = await decodeSession(sessionToken);

  if (!session) {
    redirect('/login');
  }

  const user = await prisma.adminUser.findUnique({
    where: { email: session.email.toLowerCase().trim() },
    select: {
      name: true,
      email: true,
      role: true,
    },
  });

  if (!user) {
    redirect('/login');
  }

  return (
    <AppShell role={role}>
      <section className="card">
        <div className="section-title">
          <div>
            <h3>My Account</h3>
            <p className="muted">Manage your profile details and password.</p>
          </div>
        </div>

        <dl className="profile-details">
          <div>
            <dt className="muted">Name</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt className="muted">Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt className="muted">Role</dt>
            <dd>{user.role}</dd>
          </div>
        </dl>
      </section>

      <section className="card">
        <div className="section-title">
          <div>
            <h3>Change Password</h3>
            <p className="muted">Use your current password to set a new one.</p>
          </div>
        </div>
        <ChangePasswordForm />
      </section>
    </AppShell>
  );
}
