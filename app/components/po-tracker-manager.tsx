'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  createExpectedPurchaseOrder,
  ExpectedPurchaseOrderRecord,
  JobRecord,
  resolveExpectedPurchaseOrder,
  updateExpectedPurchaseOrder
} from '@/app/actions';
import { AlertStatusBadge } from '@/app/components/alert-status-badge';
import { AppRole } from '@/lib/demo-data';

type EditableStatus = 'OPEN' | 'TRIGGERED';

function isEditableStatus(status: string): status is EditableStatus {
  return status === 'OPEN' || status === 'TRIGGERED';
}

export function PoTrackerManager({
  jobs,
  trackedPurchaseOrders,
  role,
  initialEditingId = null
}: {
  jobs: JobRecord[];
  trackedPurchaseOrders: ExpectedPurchaseOrderRecord[];
  role: AppRole;
  initialEditingId?: string | null;
}) {
  const [rows, setRows] = useState(trackedPurchaseOrders);
  const [editingId, setEditingId] = useState<string | null>(initialEditingId);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    setRows(trackedPurchaseOrders);
  }, [trackedPurchaseOrders]);

  useEffect(() => {
    if (!initialEditingId) {
      return;
    }
    const editableMatch = trackedPurchaseOrders.find(
      (entry) => entry.id === initialEditingId && isEditableStatus(entry.status)
    );
    if (editableMatch && role === 'ADMIN') {
      setEditingId(initialEditingId);
    }
  }, [initialEditingId, role, trackedPurchaseOrders]);

  const jobOptions = useMemo(
    () => [
      { id: '', label: 'No related job' },
      ...jobs.map((job) => ({ id: job.id, label: `${job.number} — ${job.name}` }))
    ],
    [jobs]
  );

  const canEditAlerts = role === 'ADMIN';

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

      <section id="tracked-po-alerts" className="card">
        <div className="section-title">
          <h3>Tracked PO Alerts</h3>
          <p className="muted">Matching is case-insensitive and trims spaces before compare.</p>
        </div>
        {errorMessage ? <p style={{ color: '#b42318', marginBottom: '0.75rem' }}>{errorMessage}</p> : null}
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
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">No tracked PO numbers yet.</td>
              </tr>
            ) : (
              rows.map((entry) => {
                const isEditing = editingId === entry.id;
                const isEditable = canEditAlerts && isEditableStatus(entry.status);

                return (
                  <tr key={entry.id}>
                    <td>
                      <AlertStatusBadge status={entry.status} />
                      <div className="muted">Triggered {entry.triggerCount} time(s)</div>
                    </td>
                    {isEditing ? (
                      <>
                        <td>
                          <input form={`po-edit-${entry.id}`} name="poNumber" defaultValue={entry.poNumber} required />
                        </td>
                        <td>
                          <select form={`po-edit-${entry.id}`} name="jobId" defaultValue={entry.jobId ?? ''}>
                            {jobOptions.map((job) => (
                              <option key={`${entry.id}-${job.id || 'none'}`} value={job.id}>
                                {job.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <textarea form={`po-edit-${entry.id}`} name="note" rows={2} defaultValue={entry.note} />
                        </td>
                      </>
                    ) : (
                      <>
                        <td>
                          {entry.poNumber}
                          <div className="muted">Normalized: {entry.normalizedPoNumber}</div>
                        </td>
                        <td>{entry.jobLabel}</td>
                        <td>{entry.note || '—'}</td>
                      </>
                    )}
                    <td>{entry.lastTriggeredAt ? new Date(entry.lastTriggeredAt).toLocaleString() : '—'}</td>
                    <td>{entry.latestAlertMessage || 'Awaiting matching receipt.'}</td>
                    <td>{new Date(entry.createdAt).toLocaleString()}</td>
                    <td>
                      <div className="row-actions">
                        {isEditing ? (
                          <>
                            <form
                              id={`po-edit-${entry.id}`}
                              className="inline-form"
                              action={async (formData) => {
                                setSavingId(entry.id);
                                setErrorMessage(null);
                                formData.set('id', entry.id);
                                const result = await updateExpectedPurchaseOrder(formData);
                                setSavingId(null);

                                if (!result.ok || !result.data) {
                                  setErrorMessage(result.error ?? 'Unable to update tracked PO right now.');
                                  return;
                                }

                                setRows((currentRows) =>
                                  currentRows.map((row) => (row.id === entry.id ? result.data! : row))
                                );
                                setEditingId(null);
                              }}
                            >
                              <button className="secondary-button" type="submit" disabled={savingId === entry.id}>
                                Save
                              </button>
                            </form>
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setErrorMessage(null);
                              }}
                            >
                              Cancel Edit
                            </button>
                          </>
                        ) : isEditable ? (
                          <>
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => {
                                setEditingId(entry.id);
                                setErrorMessage(null);
                              }}
                            >
                              Edit
                            </button>
                            <form
                              className="inline-form"
                              action={async (formData) => {
                                setSavingId(entry.id);
                                setErrorMessage(null);
                                formData.set('expectedPoId', entry.id);
                                const result = await resolveExpectedPurchaseOrder(formData);
                                setSavingId(null);

                                if (!result.ok) {
                                  setErrorMessage(result.error ?? 'Unable to resolve tracked PO right now.');
                                  return;
                                }

                                setRows((currentRows) =>
                                  currentRows.map((row) =>
                                    row.id === entry.id
                                      ? {
                                          ...row,
                                          status: 'RESOLVED',
                                          resolvedAt: new Date().toISOString()
                                        }
                                      : row
                                  )
                                );
                                if (editingId === entry.id) {
                                  setEditingId(null);
                                }
                              }}
                            >
                              <button className="danger-button" type="submit" disabled={savingId === entry.id}>
                                Cancel
                              </button>
                            </form>
                          </>
                        ) : (
                          <span className="muted">No action</span>
                        )}
                      </div>
                    </td>
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
