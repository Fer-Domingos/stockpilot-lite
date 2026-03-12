import { AppShell } from '@/app/components/app-shell';
import { getMaterialTotalQuantity, materials, transactions } from '@/lib/demo-data';
import { getRole } from '@/lib/role';

export default function ReportsPage({ searchParams }: { searchParams: { role?: string } }) {
  const role = getRole(searchParams.role);
  const transferCount = transactions.filter((entry) => entry.type === 'Transfer').length;
  const receiveCount = transactions.filter((entry) => entry.type === 'Receive').length;
  const totalUsage = transactions
    .filter((entry) => entry.type === 'Issue')
    .reduce((sum, entry) => sum + Math.abs(entry.quantity), 0);

  return (
    <AppShell role={role}>
      <section className="kpi-grid">
        <article className="card kpi-card">
          <p className="muted">Inbound Receipts (7d)</p>
          <h3>{receiveCount}</h3>
        </article>
        <article className="card kpi-card">
          <p className="muted">Internal Transfers (7d)</p>
          <h3>{transferCount}</h3>
        </article>
        <article className="card kpi-card">
          <p className="muted">Issued to Production (7d)</p>
          <h3>{totalUsage}</h3>
        </article>
      </section>

      <section className="card">
        <div className="section-title">
          <h3>Low Stock Forecast</h3>
          <p className="muted">Suggested procurement focus based on min thresholds.</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Material</th>
              <th>On Hand</th>
              <th>Min</th>
              <th>Suggested Reorder</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((item) => {
              const onHand = getMaterialTotalQuantity(item);
              const reorder = Math.max(item.minQuantity * 2 - onHand, 0);
              return (
                <tr key={item.id}>
                  <td>{item.sku}</td>
                  <td>{item.name}</td>
                  <td>{onHand}</td>
                  <td>{item.minQuantity}</td>
                  <td>{reorder === 0 ? 'Healthy' : `${reorder} ${item.unit}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
