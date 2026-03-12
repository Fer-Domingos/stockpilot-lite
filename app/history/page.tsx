import { AppShell } from '@/app/components/app-shell';
import { transactions } from '@/lib/demo-data';
import { getRole } from '@/lib/role';

export default function HistoryPage({ searchParams }: { searchParams: { role?: string } }) {
  const role = getRole(searchParams.role);

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
              <th>User</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.date}</td>
                <td>{entry.type}</td>
                <td>{entry.materialSku}</td>
                <td>{entry.materialName}</td>
                <td>
                  {entry.quantity} {entry.unit}
                </td>
                <td>{entry.from}</td>
                <td>{entry.to}</td>
                <td>{entry.user}</td>
                <td>{entry.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
