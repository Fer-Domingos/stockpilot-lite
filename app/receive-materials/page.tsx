import { AppShell } from '@/app/components/app-shell';
import { ReceiveMaterialForm } from '@/app/components/receive-material-form';
import { listJobs, listMaterials } from '@/app/actions';
import { getRole } from '@/lib/role';

export default async function ReceiveMaterialsPage({ searchParams }: { searchParams: { role?: string } }) {
  const role = getRole(searchParams.role);
  const [{ data: materials }, { data: jobs }] = await Promise.all([listMaterials(), listJobs()]);

  return (
    <AppShell role={role}>
      <section className="card">
        <div className="section-title">
          <h3>Receive Materials</h3>
          <p className="muted">Select Shop or Job as the destination for inbound inventory.</p>
        </div>
        <ReceiveMaterialForm materials={materials} jobs={jobs} />
      </section>
    </AppShell>
  );
}
