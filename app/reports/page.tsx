import { getReportsData } from "@/app/actions";
import { AppShell } from "@/app/components/app-shell";
import { LocalDateTime } from "@/app/components/local-date-time";
import { ReportsTimezoneField } from "@/app/components/reports-timezone-field";
import { getRole } from "@/lib/role";

export const dynamic = "force-dynamic";

type ReportsSearchParams = {
  role?: string;
  startDate?: string;
  endDate?: string;
  jobId?: string;
  materialId?: string;
  timeZoneOffsetMinutes?: string;
  reversalFilter?: string;
};

function normalizeReversalFilter(value?: string) {
  return value === "include" || value === "only" || value === "exclude"
    ? value
    : undefined;
}

function buildReportsQuery(params: ReportsSearchParams) {
  const query = new URLSearchParams();

  if (params.role) query.set("role", params.role);
  if (params.startDate) query.set("startDate", params.startDate);
  if (params.endDate) query.set("endDate", params.endDate);
  if (params.jobId) query.set("jobId", params.jobId);
  if (params.materialId) query.set("materialId", params.materialId);
  if (params.timeZoneOffsetMinutes) {
    query.set("timeZoneOffsetMinutes", params.timeZoneOffsetMinutes);
  }
  if (params.reversalFilter) query.set("reversalFilter", params.reversalFilter);

  return query.toString();
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: ReportsSearchParams;
}) {
  const role = await getRole(searchParams.role);
  const { data } = await getReportsData({
    startDate: searchParams.startDate,
    endDate: searchParams.endDate,
    jobId: searchParams.jobId,
    materialId: searchParams.materialId,
    timeZoneOffsetMinutes: searchParams.timeZoneOffsetMinutes,
    reversalFilter: normalizeReversalFilter(searchParams.reversalFilter),
  });

  const activeQuery = buildReportsQuery({
    role,
    startDate: data.filters.startDate ?? undefined,
    endDate: data.filters.endDate ?? undefined,
    jobId: data.filters.jobId ?? undefined,
    materialId: data.filters.materialId ?? undefined,
    timeZoneOffsetMinutes: searchParams.timeZoneOffsetMinutes,
    reversalFilter: data.filters.reversalFilter,
  });

  return (
    <AppShell role={role}>
      <section className="card">
        <div className="section-title reports-filter-header">
          <div>
            <h3>Reports</h3>
            <p className="muted">
              Reporting window: <LocalDateTime value={data.filters.startDate} kind="date" emptyLabel="All time" /> to{" "}
              <LocalDateTime value={data.filters.endDate} kind="date" emptyLabel="All time" />.
            </p>
            <p className="muted">
              Mode: {data.reportMetadata.mode}
              {data.reportMetadata.selectedJob
                ? ` · Job ${data.reportMetadata.selectedJob.number} — ${data.reportMetadata.selectedJob.name}`
                : ""}
              {data.reportMetadata.selectedMaterial
                ? ` · Material ${data.reportMetadata.selectedMaterial.sku} — ${data.reportMetadata.selectedMaterial.name}`
                : ""}
              {` · Reversals: ${data.filters.reversalFilter}`}
            </p>
          </div>
        </div>

        <form method="get" className="reports-filter-form">
          <input type="hidden" name="role" value={role} />
          <ReportsTimezoneField
            initialValue={searchParams.timeZoneOffsetMinutes}
          />
          <label>
            Start date
            <input
              type="date"
              name="startDate"
              defaultValue={data.filters.startDate ?? ""}
            />
          </label>
          <label>
            End date
            <input
              type="date"
              name="endDate"
              defaultValue={data.filters.endDate ?? ""}
            />
          </label>
          <label>
            Job
            <select name="jobId" defaultValue={data.filters.jobId ?? ""}>
              <option value="">All jobs</option>
              {data.filterOptions.jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.number} — {job.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Material
            <select
              name="materialId"
              defaultValue={data.filters.materialId ?? ""}
            >
              <option value="">All materials</option>
              {data.filterOptions.materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.sku} — {material.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Reversals
            <select name="reversalFilter" defaultValue={data.filters.reversalFilter}>
              <option value="exclude">Exclude reversals</option>
              <option value="include">Include reversals</option>
              <option value="only">Only reversals</option>
            </select>
          </label>
          <div className="reports-filter-actions">
            <button type="submit">Apply filter</button>
            <a
              className="ghost-button"
              href={`/reports/export${activeQuery ? `?${activeQuery}` : ""}`}
            >
              Export Excel
            </a>
            <a
              className="ghost-button"
              href={`/reports/export/pdf${activeQuery ? `?${activeQuery}` : ""}`}
            >
              Export PDF
            </a>
            <a
              className="ghost-button reports-reset-link"
              href={`/reports?role=${encodeURIComponent(role)}`}
            >
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
            <p className="muted">
              Current live balances split between shop stock and job
              allocations.
            </p>
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
                  <td
                    colSpan={5}
                    className="muted"
                    style={{ textAlign: "center" }}
                  >
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

      <section className="card">
        <div className="section-title">
          <div>
            <h3>Reversal Activity</h3>
            <p className="muted">
              Audit log of reversal entries included by the current reports filter.
            </p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Original ID</th>
                <th>Type</th>
                <th>Material</th>
                <th>Qty</th>
                <th>Reason</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {data.reversalActivity.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted" style={{ textAlign: "center" }}>
                    No reversal activity found for this filter.
                  </td>
                </tr>
              ) : (
                data.reversalActivity.map((entry) => (
                  <tr key={entry.id}>
                    <td><LocalDateTime value={entry.reversedAt ?? entry.createdAt} /></td>
                    <td>{entry.originalTransactionId ?? "—"}</td>
                    <td>{entry.transactionType}</td>
                    <td>
                      <div>{entry.materialName}</div>
                      <div className="muted">{entry.materialSku}</div>
                    </td>
                    <td>{entry.quantity} {entry.unit}</td>
                    <td>{entry.reversalReason}</td>
                    <td>{entry.reversedByEmail}</td>
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
              <p className="muted">
                Based on ISSUE transactions in the selected date range.
              </p>
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
                    <td
                      colSpan={3}
                      className="muted"
                      style={{ textAlign: "center" }}
                    >
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
              <p className="muted">
                Most recent inventory transactions within the selected date
                range.
              </p>
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
            <div className="status-row">
              <span>Reversals</span>
              <strong>{data.activitySummary.reversalCount}</strong>
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
                    <td
                      colSpan={6}
                      className="muted"
                      style={{ textAlign: "center" }}
                    >
                      No recent transactions found for this date range.
                    </td>
                  </tr>
                ) : (
                  data.recentActivity.map((entry) => (
                    <tr key={entry.id}>
                      <td><LocalDateTime value={entry.createdAt} /></td>
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
