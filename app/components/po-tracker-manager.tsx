'use client';

import { useState } from 'react';

import {
  cancelExpectedPurchaseOrder,
  createExpectedPurchaseOrder,
  ExpectedPurchaseOrderRecord,
  JobRecord,
  updateExpectedPurchaseOrder
} from '@/app/actions';
import { AppRole } from '@/lib/demo-data';
import { AlertStatusBadge } from '@/app/components/alert-status-badge';
import { canManageAlerts } from '@/lib/permissions';

export function PoTrackerManager({
  jobs,
  trackedPurchaseOrders,
  role
}: {
  jobs: JobRecord[];
  trackedPurchaseOrders: ExpectedPurchaseOrderRecord[];
  role: AppRole;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const canManagePoAlerts = canManageAlerts(role);

  return (
    <>
      <section className="card">
        <div className="section-title">
          <h3>Track Expected PO Numbers</h3>
          <p className="muted">Register PO numbers that should raise an alert when a matching receipt is posted.</p>
        </div>

        <form action={createExpectedPurchaseOrder}>
          <input type="hidden" name="role" value={role} />
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
          <h3>Tracked PO Alerts</h3>
          <p className="muted">Matching is case-insensitive and trims spaces before compare.</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>PO Number</th>
              <th>Related Job</th>
              <th>Note</th>
              <th>Latest Trigger</th>
              <th>Latest Notification</th>
              <th>Added</th>
            </tr>
          </thead>
          <tbody>
            {trackedPurchaseOrders.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">No tracked PO numbers yet.</td>
              </tr>
            ) : (
              trackedPurchaseOrders.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <AlertStatusBadge status={entry.status} />
                    <div className="muted">Triggered {entry.triggerCount} time(s)</div>
                  </td>
                  <td>
                    {entry.poNumber}
                    <div className="muted">Normalized: {entry.normalizedPoNumber}</div>
                  </td>
                  <td>
                    {editingId === entry.id ? (
                      <select name="jobId" defaultValue={entry.jobId ?? ''} form={`edit-po-${entry.id}`}>
                        <option value="">No related job</option>
                        {jobs.map((job) => (
                          <option key={job.id} value={job.id}>
                            {job.number} — {job.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      entry.jobLabel
                    )}
                  </td>
                  <td>
                    {editingId === entry.id ? (
                      <textarea
                        name="note"
                        rows={2}
                        defaultValue={entry.note}
                        form={`edit-po-${entry.id}`}
                        placeholder="Optional context for this PO tracking entry."
                      />
                    ) : (
                      entry.note || '—'
                    )}
                  </td>
                  <td>{entry.lastTriggeredAt ? new Date(entry.lastTriggeredAt).toLocaleString() : '—'}</td>
                  <td>{entry.latestAlertMessage || 'Awaiting matching receipt.'}</td>
                  <td>
                    {new Date(entry.createdAt).toLocaleString()}
                    <div className="row-actions" style={{ marginTop: '0.5rem' }}>
                      {canManagePoAlerts && entry.status === 'OPEN' ? (
                        editingId === entry.id ? (
                          <>
                            <form className="inline-form" id={`edit-po-${entry.id}`} action={updateExpectedPurchaseOrder}>
                              <input type="hidden" name="expectedPoId" value={entry.id} />
                              <input type="hidden" name="role" value={role} />
                              <input name="poNumber" required defaultValue={entry.poNumber} />
                              <button className="secondary-button" type="submit">
                                Save Edit
                              </button>
                            </form>
                            <button className="tertiary-button" type="button" onClick={() => setEditingId(null)}>
                              Cancel Edit
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="secondary-button" type="button" onClick={() => setEditingId(entry.id)}>
                              Edit
                            </button>
                            <form className="inline-form" action={cancelExpectedPurchaseOrder}>
                              <input type="hidden" name="expectedPoId" value={entry.id} />
                              <input type="hidden" name="role" value={role} />
                              <button
                                className="danger-button"
                                type="submit"
                                onClick={(event) => {
                                  if (!window.confirm('Cancel this PO alert? This keeps history but stops matching.')) {
                                    event.preventDefault();
                                  }
                                }}
                              >
                                Cancel
                              </button>
                            </form>
                          </>
                        )
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
