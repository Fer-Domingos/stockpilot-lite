import { AppShell } from '@/app/components/app-shell';
import { IssueMaterialForm } from '@/app/components/issue-material-form';
import { listJobs, listMaterials } from '@/app/actions';
import { getRole } from '@/lib/role';

export const dynamic = 'force-dynamic';

const errorMessages: Record<string, string> = {
  'invalid-issue': 'Material, quantity, and source are required.',
  'save-failed': 'Unable to post issue. Verify available source stock and try again.'
};

export default async function IssueMaterialsPage({
  searchParams
}: {
  searchParams: { role?: string; error?: string; success?: string };
}) {
  const role = getRole(searchParams.role);
  const [{ data: materials }, { data: jobs }] = await Promise.all([listMaterials(), listJobs()]);
  const openJobs = jobs.filter((job) => job.status === 'OPEN');
  const errorMessage = searchParams.error ? errorMessages[searchParams.error] ?? 'Unable to post issue.' : null;
  const showSuccess = searchParams.success === '1';

  return (
    <AppShell role={role}>
      <section className="card">
        <div className="section-title">
          <h3>Issue Materials</h3>
          <p className="muted">Consume stock from Shop or an Open Job into production usage.</p>
        </div>
        {errorMessage ? <p style={{ color: '#b42318', marginBottom: '0.75rem' }}>{errorMessage}</p> : null}
        {showSuccess ? <p style={{ color: '#027a48', marginBottom: '0.75rem' }}>Issue posted successfully.</p> : null}
        <IssueMaterialForm materials={materials} jobs={openJobs} />
      </section>
    </AppShell>
  );
}
