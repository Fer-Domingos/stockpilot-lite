'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  cancelExpectedPurchaseOrder,
  createExpectedPurchaseOrder,
  ExpectedPurchaseOrderRecord,
  JobRecord,
  updateExpectedPurchaseOrder
} from '@/app/actions';
import { AppRole } from '@/lib/demo-data';
import { AlertStatusBadge } from '@/app/components/alert-status-badge';
import { canManageInventory } from '@/lib/permissions';

export function PoTrackerManager({
  jobs,
  trackedPurchaseOrders,
  role
}: {
  jobs: JobRecord[];
  trackedPurchaseOrders: ExpectedPurchaseOrderRecord[];
  role: AppRole;
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<ExpectedPurchaseOrderRecord[]>(trackedPurchaseOrders);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ poNumber: '', jobId: '', note: '' });
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const canManage = canManageInventory(role);

  function beginEdit(entry: ExpectedPurchaseOrderRecord) {
    setEditingId(entry.id);
    setEditForm({
      poNumber: entry.poNumber,
      jobId: entry.jobId ?? '',
      note: entry.note
    });
    setError('');
  }

  function stopEdit() {
    setEditingId(null);
    setEditForm({ poNumber: '', jobId: '', note: '' });
    setError('');
  }

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
        {!!error && <p className="muted">{error}</p>}
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
              {canManage ? <th>Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 8 : 7} className="muted">No tracked PO numbers yet.</td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <AlertStatusBadge status={entry.status} />
                    <div className="muted">Triggered {entry.triggerCount} time(s)</div>
                  </td>
                  <td>
                    {editingId === entry.id ? (
                      <input
                        aria-label="Edit PO number"
                        value={editForm.poNumber}
                        onChange={(event) => setEditForm((current) => ({ ...current, poNumber: event.target.value }))}
                      />
                    ) : (
                      entry.poNumber
                    )}
                    <div className="muted">Normalized: {entry.normalizedPoNumber}</div>
                  </td>
                  <td>
                    {editingId === entry.id ? (
                      <select
                        aria-label="Edit related job"
                        value={editForm.jobId}
                        onChange={(event) => setEditForm((current) => ({ ...current, jobId: event.target.value }))}
                      >
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
                        aria-label="Edit note"
                        rows={2}
                        value={editForm.note}
                        onChange={(event) => setEditForm((current) => ({ ...current, note: event.target.value }))}
                      />
                    ) : (
                      entry.note || '—'
                    )}
                  </td>
                  <td>{entry.lastTriggeredAt ? new Date(entry.lastTriggeredAt).toLocaleString() : '—'}</td>
                  <td>{entry.latestAlertMessage || 'Awaiting matching receipt.'}</td>
                  <td>{new Date(entry.createdAt).toLocaleString()}</td>
                  {canManage ? (
                    <td>
                      <div className="row-actions">
                        {editingId === entry.id ? (
                          <>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => {
                                setError('');
                                startTransition(async () => {
                                  const result = await updateExpectedPurchaseOrder(entry.id, {
                                    poNumber: editForm.poNumber,
                                    jobId: editForm.jobId || null,
                                    note: editForm.note
                                  });

                                  if (!result.ok || !result.data) {
                                    setError(result.error ?? 'Failed to save tracked PO.');
                                    return;
                                  }

                                  const updatedEntry = result.data;
                                  setEntries((current) =>
                                    current.map((item) => (item.id === entry.id ? updatedEntry : item))
                                  );
                                  stopEdit();
                                  router.refresh();
                                });
                              }}
                            >
                              {isPending ? 'Saving...' : 'Save'}
                            </button>
                            <button className="secondary-button" type="button" onClick={stopEdit}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="secondary-button" type="button" onClick={() => beginEdit(entry)}>
                              Edit
                            </button>
                            <button
                              className="danger-button"
                              type="button"
                              disabled={isPending}
                              onClick={() => {
                                setError('');
                                startTransition(async () => {
                                  const result = await cancelExpectedPurchaseOrder(entry.id);
                                  if (!result.ok) {
                                    setError(result.error ?? 'Failed to cancel tracked PO.');
                                    return;
                                  }

                                  setEntries((current) =>
                                    current.map((item) =>
                                      item.id === entry.id
                                        ? { ...item, status: 'RESOLVED', resolvedAt: new Date().toISOString() }
                                        : item
                                    )
                                  );
                                  router.refresh();
                                });
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
