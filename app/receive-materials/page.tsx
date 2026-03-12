import { AppShell } from '@/app/components/app-shell';
import { ReceiveMaterialForm } from '@/app/components/receive-material-form';
import { getRole } from '@/lib/role';

export default function ReceiveMaterialsPage({ searchParams }: { searchParams: { role?: string } }) {
  const role = getRole(searchParams.role);

  return (
    <AppShell role={role}>
      <section className="card">
        <div className="section-title">
          <h3>Receive Materials</h3>
          <p className="muted">Select Shop or Job as the destination for inbound inventory.</p>
        </div>
        <ReceiveMaterialForm />
      </section>
    </AppShell>
  );
}
