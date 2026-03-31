'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  AlertStatus,
  createExpectedPurchaseOrder,
  ExpectedPurchaseOrderRecord,
  JobRecord,
  setExpectedPurchaseOrderStatus,
  updateExpectedPurchaseOrder
} from '@/app/actions';
import { AppRole } from '@/lib/demo-data';
import { AlertStatusBadge } from '@/app/components/alert-status-badge';
import { canManageAlerts } from '@/lib/permissions';

type PoFormState = {
  poNumber: string;
  jobId: string;
  note: string;
};

const emptyForm: PoFormState = {
  poNumber: '',
  jobId: '',
  note: ''
};

const filterOptions: Array<{ label: string; value: 'ALL' | AlertStatus }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Open', value: 'OPEN' },
  { label: 'Triggered', value: 'TRIGGERED' },
  { label: 'Seen', value: 'SEEN' },
  { label: 'Resolved', value: 'RESOLVED' }
];

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
  const [rows, setRows] = useState<ExpectedPurchaseOrderRecord[]>(trackedPurchaseOrders);
  const [form, setForm] = useState<PoFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | AlertStatus>('ALL');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const canUpdate = canManageAlerts(role);

  const filteredRows = useMemo(() => {
    if (activeFilter === 'ALL') {
      return rows;
    }
    return rows.filter((entry) => entry.status === activeFilter);
  }, [activeFilter, rows]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  return (
    <>
      <section className="card">
        <div className="section-title">
          <h3>{editingId ? 'Edit Tracked PO Alert' : 'Track Expected PO Numbers'}</h3>
          <p className="muted">Register PO numbers that should raise an alert when a matching receipt is posted.</p>
        </div>
        {error ? <p className="muted">{error}</p> : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            setError('');

            const payload = {
              poNumber: form.poNumber.trim(),
              jobId: form.jobId.trim() || null,
              note: form.note.trim()
            };

            startTransition(async () => {
              if (editingId) {
                const result = await updateExpectedPurchaseOrder(editingId, payload);
                if (!result.ok || !result.data) {
                  setError(result.error ?? 'Unable to save tracked PO.');
                  return;
                }
                setRows((current) => current.map((row) => (row.id === editingId ? result.data! : row)));
              } else {
                const fd = new FormData();
                fd.set('poNumber', payload.poNumber);
                fd.set('jobId', payload.jobId ?? '');
                fd.set('note', payload.note);
                const result = await createExpectedPurchaseOrder(fd);
                if (!result.ok || !result.data) {
                  setError(result.error ?? 'Unable to save tracked PO.');
                  return;
                }
                setRows((current) => [result.data!, ...current]);
              }

              resetForm();
              router.refresh();
            });
          }}
        >
          <label htmlFor="poNumber">PO Number</label>
          <input
            id="poNumber"
            name="poNumber"
            value={form.poNumber}
            onChange={(event) => setForm((current) => ({ ...current, poNumber: event.target.value }))}
            required
            placeholder="6-2353-01"
          />

          <label htmlFor="jobId">Related Job</label>
          <select
            id="jobId"
            name="jobId"
            value={form.jobId}
            onChange={(event) => setForm((current) => ({ ...current, jobId: event.target.value }))}
          >
            <option value="">No related job</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.number} — {job.name}
              </option>
            ))}
          </select>

          <label htmlFor="note">Note</label>
          <textarea
            id="note"
            name="note"
            rows={3}
            value={form.note}
            onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            placeholder="Optional context for this PO tracking entry."
          />

          <button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : editingId ? 'Save PO Alert' : 'Track PO Number'}
          </button>
          {editingId ? (
            <button className="secondary-button" type="button" onClick={resetForm}>
              Cancel Edit
            </button>
          ) : null}
        </form>
      </section>

      <section className="card">
        <div className="section-title">
          <h3>PO Alerts</h3>
          <p className="muted">Matching is case-insensitive and trims spaces before compare.</p>
        </div>
        <div className="row-actions" style={{ marginBottom: '0.75rem' }}>
          {filterOptions.map((option) => (
            <button
              key={option.value}
              className={activeFilter === option.value ? '' : 'secondary-button'}
              onClick={() => setActiveFilter(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
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
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">No PO alerts found for this filter.</td>
              </tr>
            ) : (
              filteredRows.map((entry) => (
                <tr key={entry.id}>
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
                    {canUpdate ? (
                      <div className="row-actions">
                        <button
                          className="secondary-button"
                          onClick={() => {
                            setEditingId(entry.id);
                            setForm({
                              poNumber: entry.poNumber,
                              jobId: entry.jobId ?? '',
                              note: entry.note
                            });
                          }}
                          type="button"
                        >
                          Edit
                        </button>
                        {entry.status === 'RESOLVED' ? (
                          <button
                            className="secondary-button"
                            onClick={() => {
                              setError('');
                              startTransition(async () => {
                                const result = await setExpectedPurchaseOrderStatus(entry.id, 'OPEN');
                                if (!result.ok) {
                                  setError(result.error ?? 'Unable to reopen alert.');
                                  return;
                                }
                                setRows((current) =>
                                  current.map((row) => (row.id === entry.id ? { ...row, status: 'OPEN' } : row))
                                );
                                router.refresh();
                              });
                            }}
                            type="button"
                          >
                            Reopen
                          </button>
                        ) : (
                          <button
                            className="danger-button"
                            onClick={() => {
                              setError('');
                              startTransition(async () => {
                                const result = await setExpectedPurchaseOrderStatus(entry.id, 'RESOLVED');
                                if (!result.ok) {
                                  setError(result.error ?? 'Unable to cancel alert.');
                                  return;
                                }
                                setRows((current) =>
                                  current.map((row) => (row.id === entry.id ? { ...row, status: 'RESOLVED' } : row))
                                );
                                if (editingId === entry.id) {
                                  resetForm();
                                }
                                router.refresh();
                              });
                            }}
                            type="button"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="muted">Read only</span>
                    )}
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
