import { redirect } from 'next/navigation';

import { AppShell } from '@/app/components/app-shell';
import { CreateUserForm } from '@/app/users/create-user-form';
import { ResetPasswordForm } from '@/app/users/reset-password-form';
import { prisma } from '@/lib/prisma';
import { getRole } from '@/lib/role';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const role = await getRole();

  if (role !== 'ADMIN') {
    redirect('/dashboard');
  }

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
