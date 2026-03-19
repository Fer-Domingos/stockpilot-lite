import { AppShell } from '@/app/components/app-shell';
import { TransferMaterialForm } from '@/app/components/transfer-material-form';
import { listJobs, listMaterials } from '@/app/actions';
import { getRole } from '@/lib/role';

export const dynamic = 'force-dynamic';

const errorMessages: Record<string, string> = {
  'invalid-transfer': 'Material, source, destination, and quantity are required.',
  'save-failed': 'Unable to transfer stock. Verify available source stock and try again.'
};

export default async function TransferMaterialsPage({
  searchParams
}: {
  searchParams: { role?: string; error?: string; success?: string };
}) {
  const role = getRole(searchParams.role);
  const [{ data: materials }, { data: jobs }] = await Promise.all([listMaterials(), listJobs()]);
  const openJobs = jobs.filter((job) => job.status === 'OPEN');
  const errorMessage = searchParams.error ? errorMessages[searchParams.error] ?? 'Unable to transfer material.' : null;
  const showSuccess = searchParams.success === '1';

  return (
    <AppShell role={role}>
      <section className="card">
        <div className="section-title">
          <h3>Transfer Materials</h3>
          <p className="muted">Supported: Shop → Job, Job → Shop, and Job → Job transfers.</p>
        </div>
        {errorMessage ? <p style={{ color: '#b42318', marginBottom: '0.75rem' }}>{errorMessage}</p> : null}
        {showSuccess ? <p style={{ color: '#027a48', marginBottom: '0.75rem' }}>Transfer posted successfully.</p> : null}
        <TransferMaterialForm materials={materials} jobs={openJobs} />
      </section>
    </AppShell>
  );
}
