import { AppShell } from '@/app/components/app-shell';
import { JobsManager } from '@/app/components/jobs-manager';
import { listJobs } from '@/app/actions';
import { getRole } from '@/lib/role';

export default async function JobsPage({ searchParams }: { searchParams: { role?: string } }) {
  const role = await getRole(searchParams.role);
  const { data } = await listJobs();

  const importJobsAction = async (file: File) => {
    'use server';

    try {
      const actionsModule = (await import('@/app/actions')) as Record<string, unknown>;
      const importJobsFromExcel = actionsModule['importJobsFromExcel'];

      if (typeof importJobsFromExcel !== 'function') {
        return {
          ok: false,
          error: 'Job import is currently unavailable.'
        };
      }

      return await (importJobsFromExcel as (upload: File) => Promise<{ ok: boolean; error?: string; data?: unknown }>)(
        file
      );
    } catch (error) {
      console.error('Failed to execute jobs import action:', error);
      return {
        ok: false,
        error: 'Unable to import jobs right now.'
      };
    }
  };

  return (
    <AppShell role={role}>
      <JobsManager initialJobs={data} role={role} importJobsFromExcel={importJobsAction} />
    </AppShell>
  );
}
