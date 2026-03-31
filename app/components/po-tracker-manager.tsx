'use client';

import { useState } from 'react';

import {
  createExpectedPurchaseOrder,
  ExpectedPurchaseOrderRecord,
  JobRecord,
  performExpectedPurchaseOrderAction,
  updateExpectedPurchaseOrder
} from '@/app/actions';
import { AppRole } from '@/lib/demo-data';
import { AlertStatusBadge } from '@/app/components/alert-status-badge';

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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {trackedPurchaseOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">No tracked PO numbers yet.</td>
              </tr>
            ) : (
              trackedPurchaseOrders.map((entry) => {
                const isEditing = editingId === entry.id;
                const canReopen = entry.status === 'RESOLVED';
                const canDone = entry.status === 'OPEN' || entry.status === 'TRIGGERED';

                return (
                  <tr key={entry.id}>
                    {isEditing ? (
                      <>
                        <td>
                          <form className="inline-form" action={updateExpectedPurchaseOrder} id={`edit-po-${entry.id}`}>
                            <input type="hidden" name="role" value={role} />
                            <input type="hidden" name="expectedPoId" value={entry.id} />
                            <AlertStatusBadge status={entry.status} />
                            <div className="muted">Triggered {entry.triggerCount} time(s)</div>
                          </form>
                        </td>
                        <td>
                          <input
                            form={`edit-po-${entry.id}`}
                            name="poNumber"
                            required
                            defaultValue={entry.poNumber}
                            aria-label="PO Number"
                          />
                        </td>
                        <td>
                          <select form={`edit-po-${entry.id}`} name="jobId" defaultValue={entry.jobId ?? ''} aria-label="Related Job">
                            <option value="">No related job</option>
                            {jobs.map((job) => (
                              <option key={job.id} value={job.id}>
                                {job.number} — {job.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input form={`edit-po-${entry.id}`} name="note" defaultValue={entry.note} aria-label="Note" placeholder="Optional note" />
                        </td>
                        <td>{entry.lastTriggeredAt ? new Date(entry.lastTriggeredAt).toLocaleString() : '—'}</td>
                        <td>{entry.latestAlertMessage || 'Awaiting matching receipt.'}</td>
                        <td>{new Date(entry.createdAt).toLocaleString()}</td>
                        <td>
                          <button className="secondary-button" type="submit" form={`edit-po-${entry.id}`}>
                            Save
                          </button>
                          <button className="ghost-button" type="button" onClick={() => setEditingId(null)}>
                            Cancel
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>
                          <AlertStatusBadge status={entry.status} />
                          <div className="muted">Triggered {entry.triggerCount} time(s)</div>
                        </td>
                        <td>
                          {entry.poNumber}
                          <div className="muted">Normalized: {entry.normalizedPoNumber}</div>
                        </td>
                        <td>{entry.jobLabel}</td>
                        <td>{entry.note || '—'}</td>
                        <td>{entry.lastTriggeredAt ? new Date(entry.lastTriggeredAt).toLocaleString() : '—'}</td>
                        <td>{entry.latestAlertMessage || 'Awaiting matching receipt.'}</td>
                        <td>{new Date(entry.createdAt).toLocaleString()}</td>
                        <td>
                          <form className="inline-form" action={performExpectedPurchaseOrderAction}>
                            <input type="hidden" name="expectedPoId" value={entry.id} />
                            <input type="hidden" name="role" value={role} />
                            <select
                              name="actionType"
                              aria-label={`Action for ${entry.poNumber}`}
                              defaultValue=""
                              onChange={(event) => {
                                const action = event.target.value;
                                if (!action) {
                                  return;
                                }

                                if (action === 'edit') {
                                  setEditingId(entry.id);
                                  event.target.value = '';
                                  return;
                                }

                                setEditingId(null);
                                event.currentTarget.form?.requestSubmit();
                              }}
                            >
                              <option value="">Select Action</option>
                              <option value="edit">Edit</option>
                              {canDone && <option value="resolve">Done</option>}
                              {canReopen && <option value="reopen">Reopen</option>}
                            </select>
                          </form>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
