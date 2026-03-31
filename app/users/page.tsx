import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

import { AppShell } from '@/app/components/app-shell';
import { CreateUserForm } from '@/app/users/create-user-form';
import { ResetPasswordForm } from '@/app/users/reset-password-form';
import { UserManagementActions } from '@/app/users/user-management-actions';
import { prisma } from '@/lib/prisma';
import { authConfig, decodeSession } from '@/lib/session';
import { getRole } from '@/lib/role';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const role = await getRole();

  if (role !== 'ADMIN') {
    redirect('/dashboard');
  }

  const sessionToken = cookies().get(authConfig.sessionCookieName)?.value;
  const session = await decodeSession(sessionToken);

  const users = await prisma.adminUser.findMany({
    orderBy: [{ role: 'asc' }, { name: 'asc' }, { email: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  const adminCount = users.filter((user) => user.role === 'ADMIN').length;

  return (
    <AppShell role={role}>
      <CreateUserForm />

      <section className="card">
        <div className="section-title">
          <div>
            <h3>Existing Users</h3>
            <p className="muted">Only admins can view and manage application users.</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(user.createdAt)}</td>
                <td>
                  <UserManagementActions
                    userId={user.id}
                    currentRole={user.role}
                    isCurrentUser={session?.email === user.email}
                    removeDisabledReason={
                      user.email === 'admin@stockpilot.com'
                        ? 'The seeded system admin cannot be removed.'
                        : user.role === 'ADMIN' && adminCount <= 1
                          ? 'At least one admin account must remain.'
                          : undefined
                    }
                  />
                  <ResetPasswordForm userId={user.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
