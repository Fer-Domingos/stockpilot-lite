import { AppShell } from '@/app/components/app-shell';
import { JobsManager } from '@/app/components/jobs-manager';
import { listJobs } from '@/app/actions';
import { getRole } from '@/lib/role';

function parseStatusFilter(value?: string): 'ALL' | 'OPEN' | 'CLOSED' {
  if (!value) {
    return 'ALL';
  }

  const normalizedValue = value.trim().toUpperCase();
  if (normalizedValue === 'OPEN' || normalizedValue === 'CLOSED') {
    return normalizedValue;
  }

  return 'ALL';
}

export default async function JobsPage({ searchParams }: { searchParams: { role?: string; status?: string } }) {
  const role = await getRole(searchParams.role);
  const { data } = await listJobs();
  const initialStatusFilter = parseStatusFilter(searchParams.status);

  return (
    <AppShell role={role}>
      <JobsManager initialJobs={data} role={role} initialStatusFilter={initialStatusFilter} />
    </AppShell>
  );
}
