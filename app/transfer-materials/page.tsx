import { AppShell } from '@/app/components/app-shell';
import { TransferMaterialForm } from '@/app/components/transfer-material-form';
import { getRole } from '@/lib/role';

export default function TransferMaterialsPage({ searchParams }: { searchParams: { role?: string } }) {
  const role = getRole(searchParams.role);

  return (
    <AppShell role={role}>
      <section className="card">
        <div className="section-title">
          <h3>Transfer Materials</h3>
          <p className="muted">Supported: Shop → Job, Job → Shop, and Job → Job transfers.</p>
        </div>
        <TransferMaterialForm />
      </section>
    </AppShell>
  );
}
