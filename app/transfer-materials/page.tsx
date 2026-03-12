import { AppShell } from '@/app/components/app-shell';
import { TransferMaterialForm } from '@/app/components/transfer-material-form';
import { listJobs, listMaterials } from '@/app/actions';
import { getRole } from '@/lib/role';

export default async function TransferMaterialsPage({ searchParams }: { searchParams: { role?: string } }) {
  const role = getRole(searchParams.role);
  const [{ data: materials }, { data: jobs }] = await Promise.all([listMaterials(), listJobs()]);

  return (
    <AppShell role={role}>
      <section className="card">
        <div className="section-title">
          <h3>Transfer Materials</h3>
          <p className="muted">Supported: Shop → Job, Job → Shop, and Job → Job transfers.</p>
        </div>
        <TransferMaterialForm materials={materials} jobs={jobs} />
      </section>
    </AppShell>
  );
}
