import { AppShell } from '@/app/components/app-shell';
import { JobsManager } from '@/app/components/jobs-manager';
import { listJobs } from '@/app/actions';
import { getRole } from '@/lib/role';

export default async function JobsPage({ searchParams }: { searchParams: { role?: string } }) {
  const role = getRole(searchParams.role);
  const { data, usingFallback } = await listJobs();

  return (
    <AppShell role={role}>
      <JobsManager initialJobs={data} usingFallback={usingFallback} />
    </AppShell>
  );
}
