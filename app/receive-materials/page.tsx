import { AppShell } from '@/app/components/app-shell';
import { ReceiveMaterialForm } from '@/app/components/receive-material-form';
import { listJobs, listMaterials } from '@/app/actions';
import { getRole } from '@/lib/role';

export default async function ReceiveMaterialsPage({ searchParams }: { searchParams: { role?: string } }) {
  const role = getRole(searchParams.role);
  const [{ data: materials }, { data: jobs }] = await Promise.all([listMaterials(), listJobs()]);
  const openJobs = jobs.filter((job) => job.status === 'OPEN');

  return (
    <AppShell role={role}>
      <section className="card">
        <div className="section-title">
          <h3>Receive Materials</h3>
          <p className="muted">Capture vendor receipts with invoice, destination, and optional photo reference.</p>
        </div>
        <ReceiveMaterialForm materials={materials} jobs={openJobs} />
      </section>
    </AppShell>
  );
}
