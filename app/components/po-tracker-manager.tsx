'use client';

import { createExpectedPurchaseOrder, ExpectedPurchaseOrderRecord, JobRecord, PurchaseOrderAlertRecord } from '@/app/actions';

export function PoTrackerManager({
  jobs,
  trackedPurchaseOrders,
  alerts
}: {
  jobs: JobRecord[];
  trackedPurchaseOrders: ExpectedPurchaseOrderRecord[];
  alerts: PurchaseOrderAlertRecord[];
}) {
  return (
    <>
      <section className="card">
        <div className="section-title">
          <h3>Track Expected PO Numbers</h3>
          <p className="muted">Register PO numbers that should raise an alert when a matching receipt is posted.</p>
        </div>

        <form action={createExpectedPurchaseOrder}>
          <label htmlFor="poNumber">PO Number</label>
          <input id="poNumber" name="poNumber" required placeholder="6-2353-01" />

          <label htmlFor="jobId">Related Job</label>
          <select id="jobId" name="jobId" defaultValue="">
            <option value="">No related job</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.number} — {job.name}
              </option>
            ))}
          </select>

          <label htmlFor="note">Note</label>
          <textarea id="note" name="note" rows={3} placeholder="Optional context for this PO tracking entry." />

          <button type="submit">Track PO Number</button>
        </form>
      </section>

      <section className="card">
        <div className="section-title">
          <h3>Tracked PO Numbers</h3>
          <p className="muted">Matching is case-insensitive and trims spaces before compare.</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>PO Number</th>
              <th>Related Job</th>
              <th>Note</th>
              <th>Added</th>
            </tr>
          </thead>
          <tbody>
            {trackedPurchaseOrders.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">No tracked PO numbers yet.</td>
              </tr>
            ) : (
              trackedPurchaseOrders.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    {entry.poNumber}
                    <div className="muted">Normalized: {entry.normalizedPoNumber}</div>
                  </td>
                  <td>{entry.jobLabel}</td>
                  <td>{entry.note || '—'}</td>
                  <td>{new Date(entry.createdAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="card">
        <div className="section-title">
          <h3>PO Alerts</h3>
          <p className="muted">Alerts appear here after a RECEIVE invoice/PO number matches a tracked PO number.</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Alerted</th>
              <th>PO</th>
              <th>Material</th>
              <th>Invoice / PO</th>
              <th>Related Job</th>
              <th>Note</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">No PO alerts yet.</td>
              </tr>
            ) : (
              alerts.map((alert) => (
                <tr key={alert.id}>
                  <td>{new Date(alert.createdAt).toLocaleString()}</td>
                  <td>{alert.poNumber}</td>
                  <td>
                    {alert.materialName}
                    <div className="muted">{alert.materialSku}</div>
                  </td>
                  <td>{alert.invoiceNumber}</td>
                  <td>{alert.relatedJobLabel}</td>
                  <td>{alert.note || '—'}</td>
                  <td>{alert.message}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
