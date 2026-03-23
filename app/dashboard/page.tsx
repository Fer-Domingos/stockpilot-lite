import { AppShell } from '@/app/components/app-shell';
import { getDashboardData } from '@/app/actions';
import { getRole } from '@/lib/role';

export default async function DashboardPage({ searchParams }: { searchParams: { role?: string } }) {
  const role = getRole(searchParams.role);
  const data = await getDashboardData();

  return (
    <AppShell role={role}>
      <section className="kpi-grid">
        <article className="card kpi-card">
          <p className="muted">SKUs Tracked</p>
          <h3>{data.totalSku}</h3>
        </article>
        <article className="card kpi-card">
          <p className="muted">Low Stock Alerts</p>
          <h3>{data.lowStock}</h3>
        </article>
        <article className="card kpi-card">
          <p className="muted">Open Jobs</p>
          <h3>{data.openJobs}</h3>
        </article>
        <article className="card kpi-card">
          <p className="muted">Inventory Units On Hand</p>
          <h3>{data.totalInventoryUnits.toLocaleString()}</h3>
        </article>
      </section>

      <section className="card">
        <div className="section-title">
          <h3>PO Alert Notifications</h3>
          <p className="muted">Triggered when a received invoice/PO number matches a tracked PO number.</p>
        </div>
        {data.poAlerts.length === 0 ? (
          <p className="muted">No PO alerts yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Alerted</th>
                <th>PO</th>
                <th>Material</th>
                <th>Related Job</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {data.poAlerts.map((alert) => (
                <tr key={alert.id}>
                  <td>{new Date(alert.createdAt).toLocaleString()}</td>
                  <td>{alert.poNumber}</td>
                  <td>
                    {alert.materialName}
                    <div className="muted">{alert.materialSku}</div>
                  </td>
                  <td>{alert.relatedJobLabel}</td>
                  <td>{alert.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
              <th>From</th>
              <th>To</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            {data.recentTransactions.map((entry) => (
              <tr key={entry.id}>
                <td>{new Date(entry.createdAt).toLocaleString()}</td>
                <td>{entry.type}</td>
                <td>{entry.materialName}</td>
                <td>{entry.locationFrom}</td>
                <td>{entry.locationTo}</td>
                <td>
                  {entry.quantity} {entry.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <div className="section-title">
          <h3>Inventory At-A-Glance</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>Location</th>
              <th>Quantity On Hand</th>
            </tr>
          </thead>
          <tbody>
            {data.inventoryRows.map((row) => (
              <tr key={row.id}>
                <td>
                  {row.materialName}
                  <div className="muted">{row.materialSku}</div>
                </td>
                <td>{row.locationLabel}</td>
                <td>
                  {row.quantity} {row.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
