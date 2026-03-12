import { AppShell } from '@/app/components/app-shell';
import { listInventoryTransactions } from '@/app/actions';
import { getRole } from '@/lib/role';

export default async function HistoryPage({ searchParams }: { searchParams: { role?: string } }) {
  const role = getRole(searchParams.role);
  const { data: transactions } = await listInventoryTransactions();

  return (
    <AppShell role={role}>
      <section className="card">
        <div className="section-title">
          <h3>Transaction History</h3>
          <p className="muted">Professional audit trail with realistic demo transaction data.</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>SKU</th>
              <th>Material</th>
              <th>Qty</th>
              <th>From</th>
              <th>To</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((entry) => (
              <tr key={entry.id}>
                <td>{new Date(entry.createdAt).toLocaleString()}</td>
                <td>{entry.type}</td>
                <td>{entry.materialSku}</td>
                <td>{entry.materialName}</td>
                <td>
                  {entry.quantity} {entry.unit}
                </td>
                <td>{entry.locationFrom}</td>
                <td>{entry.locationTo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
