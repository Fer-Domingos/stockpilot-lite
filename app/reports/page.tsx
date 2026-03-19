import { getReportsData } from '@/app/actions';
import { AppShell } from '@/app/components/app-shell';
import { getRole } from '@/lib/role';

export const dynamic = 'force-dynamic';

type ReportsSearchParams = {
  role?: string;
  startDate?: string;
  endDate?: string;
};

function formatDate(value: string | null) {
  if (!value) {
    return 'All time';
  }

  const parsed = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString();
}

export default async function ReportsPage({ searchParams }: { searchParams: ReportsSearchParams }) {
  const role = getRole(searchParams.role);
  const { data } = await getReportsData({
    startDate: searchParams.startDate,
    endDate: searchParams.endDate
  });

  return (
    <AppShell role={role}>
      <section className="card">
        <div className="section-title reports-filter-header">
          <div>
            <h3>Reports</h3>
            <p className="muted">
              Reporting window: {formatDate(data.filters.startDate)} to {formatDate(data.filters.endDate)}.
            </p>
          </div>
        </div>

        <form method="get" className="reports-filter-form">
          <input type="hidden" name="role" value={role} />
          <label>
            Start date
            <input type="date" name="startDate" defaultValue={data.filters.startDate ?? ''} />
          </label>
          <label>
            End date
            <input type="date" name="endDate" defaultValue={data.filters.endDate ?? ''} />
          </label>
          <div className="reports-filter-actions">
            <button type="submit">Apply filter</button>
            <a className="ghost-button reports-reset-link" href={`/reports?role=${encodeURIComponent(role)}`}>
              Clear
            </a>
          </div>
        </form>
      </section>

      <section className="kpi-grid">
        <article className="card kpi-card">
          <p className="muted">Materials tracked</p>
          <h3>{data.inventorySummary.materialCount}</h3>
        </article>
        <article className="card kpi-card">
          <p className="muted">Transactions in range</p>
          <h3>{data.activitySummary.totalTransactions}</h3>
        </article>
        <article className="card kpi-card">
          <p className="muted">Issued units in range</p>
          <h3>{data.activitySummary.issueQuantity}</h3>
        </article>
        <article className="card kpi-card">
          <p className="muted">Receipts in range</p>
          <h3>{data.activitySummary.receiveQuantity}</h3>
        </article>
      </section>

      <section className="card">
        <div className="section-title">
          <div>
            <h3>Total Inventory by Material</h3>
            <p className="muted">Current live balances split between shop stock and job allocations.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th>Unit</th>
                <th>Shop Quantity</th>
                <th>Total Job Quantity</th>
                <th>Total Inventory</th>
              </tr>
            </thead>
            <tbody>
              {data.inventorySummary.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted" style={{ textAlign: 'center' }}>
                    No inventory balances found.
                  </td>
                </tr>
              ) : (
                data.inventorySummary.rows.map((row) => (
                  <tr key={row.materialId}>
                    <td>
                      <div>{row.materialName}</div>
                      <div className="muted">{row.materialSku}</div>
                    </td>
                    <td>{row.unit}</td>
                    <td>{row.shopQuantity}</td>
                    <td>{row.totalJobQuantity}</td>
                    <td>{row.totalQuantity}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="reports-two-column">
        <article className="card">
          <div className="section-title">
            <div>
              <h3>Most Used Materials</h3>
              <p className="muted">Based on ISSUE transactions in the selected date range.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Issue Transactions</th>
                  <th>Total Issued</th>
                </tr>
              </thead>
              <tbody>
                {data.topMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="muted" style={{ textAlign: 'center' }}>
                      No issue activity found for this date range.
                    </td>
                  </tr>
                ) : (
                  data.topMaterials.map((row) => (
                    <tr key={row.materialId}>
                      <td>
                        <div>{row.materialName}</div>
                        <div className="muted">{row.materialSku}</div>
                      </td>
                      <td>{row.issueCount}</td>
                      <td>
                        {row.issuedQuantity} {row.unit}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card">
          <div className="section-title">
            <div>
              <h3>Recent Activity Summary</h3>
              <p className="muted">Most recent inventory transactions within the selected date range.</p>
            </div>
          </div>

          <div className="reports-activity-totals">
            <div className="status-row">
              <span>Receives</span>
              <strong>{data.activitySummary.receiveCount}</strong>
            </div>
            <div className="status-row">
              <span>Transfers</span>
              <strong>{data.activitySummary.transferCount}</strong>
            </div>
            <div className="status-row">
              <span>Issues</span>
              <strong>{data.activitySummary.issueCount}</strong>
            </div>
            <div className="status-row">
              <span>Adjustments</span>
              <strong>{data.activitySummary.adjustmentCount}</strong>
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Material</th>
                  <th>Qty</th>
                  <th>From</th>
                  <th>To</th>
                </tr>
              </thead>
              <tbody>
                {data.recentActivity.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted" style={{ textAlign: 'center' }}>
                      No recent transactions found for this date range.
                    </td>
                  </tr>
                ) : (
                  data.recentActivity.map((entry) => (
                    <tr key={entry.id}>
                      <td>{new Date(entry.createdAt).toLocaleString()}</td>
                      <td>{entry.type}</td>
                      <td>{entry.materialName}</td>
                      <td>
                        {entry.quantity} {entry.unit}
                      </td>
                      <td>{entry.locationFrom}</td>
                      <td>{entry.locationTo}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
