import { AppShell } from '@/app/components/app-shell';
import { JobsManager } from '@/app/components/jobs-manager';
import { listJobs } from '@/app/actions';
import { getRole } from '@/lib/role';

export default async function JobsPage({ searchParams }: { searchParams: { role?: string } }) {
  const role = await getRole(searchParams.role);
  const { data } = await listJobs();
  const safeJobs = Array.isArray(data) ? data : [];

  return (
    <AppShell role={role}>
      <JobsManager initialJobs={safeJobs} role={role} />
    </AppShell>
  );
}
