import { AppShell } from '@/app/components/app-shell';
import { getMaterialTotalQuantity, materials, summarizeInventory, transactions } from '@/lib/demo-data';
import { getRole } from '@/lib/role';

export default function DashboardPage({ searchParams }: { searchParams: { role?: string } }) {
  const role = getRole(searchParams.role);
  const summary = summarizeInventory();

  return (
    <AppShell role={role}>
      <section className="kpi-grid">
        <article className="card kpi-card">
          <p className="muted">SKUs Tracked</p>
          <h3>{summary.totalSku}</h3>
        </article>
        <article className="card kpi-card">
          <p className="muted">Low Stock Alerts</p>
          <h3>{summary.lowStock}</h3>
        </article>
        <article className="card kpi-card">
          <p className="muted">Open Jobs</p>
          <h3>{summary.openJobs}</h3>
        </article>
        <article className="card kpi-card">
          <p className="muted">Inventory Value</p>
          <h3>${summary.inventoryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
        </article>
      </section>

      <section className="card">
        <div className="section-title">
          <h3>Recent Transactions</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Material</th>
              <th>Route</th>
              <th>Qty</th>
              <th>User</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.date}</td>
                <td>{entry.type}</td>
                <td>{entry.materialName}</td>
                <td>
                  {entry.from} → {entry.to}
                </td>
                <td>
                  {entry.quantity} {entry.unit}
                </td>
                <td>{entry.user}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <div className="section-title">
          <h3>Inventory At-A-Glance</h3>
        </div>
        <div className="grid">
          {materials.map((item) => {
            const totalQuantity = getMaterialTotalQuantity(item);
            return (
              <div className="status-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <p className="muted">{item.sku}</p>
                </div>
                <p className={totalQuantity <= item.minQuantity ? 'stock-badge low' : 'stock-badge'}>
                  {totalQuantity} {item.unit}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
