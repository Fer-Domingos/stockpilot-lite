'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  createExpectedPurchaseOrder,
  ExpectedPurchaseOrderRecord,
  JobRecord,
  updateExpectedPurchaseOrder
} from '@/app/actions';
import { AlertStatusBadge } from '@/app/components/alert-status-badge';
import { isActiveAlertStatus } from '@/lib/alert-status';
import { AppRole } from '@/lib/demo-data';

type TrackedPoForm = {
  poNumber: string;
  jobId: string;
  note: string;
};

const emptyForm: TrackedPoForm = {
  poNumber: '',
  jobId: '',
  note: ''
};

export function PoTrackerManager({
  jobs,
  trackedPurchaseOrders,
  inactiveTrackedPurchaseOrders,
  role
}: {
  jobs: JobRecord[];
  trackedPurchaseOrders: ExpectedPurchaseOrderRecord[];
  inactiveTrackedPurchaseOrders: ExpectedPurchaseOrderRecord[];
  role: AppRole;
}) {
  const router = useRouter();
  const [activeRows, setActiveRows] = useState<ExpectedPurchaseOrderRecord[]>(trackedPurchaseOrders);
  const [inactiveRows, setInactiveRows] = useState<ExpectedPurchaseOrderRecord[]>(inactiveTrackedPurchaseOrders);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TrackedPoForm>(emptyForm);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const combinedRows = useMemo(() => [...activeRows, ...inactiveRows], [activeRows, inactiveRows]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  }

  function startEditing(entry: ExpectedPurchaseOrderRecord) {
    setEditingId(entry.id);
    setForm({
      poNumber: entry.poNumber,
      jobId: entry.jobId ?? '',
      note: entry.note
    });
    setError('');
  }

  return (
    <>
      <section className="card">
        <div className="section-title">
          <h3>{editingId ? 'Edit Tracked PO Number' : 'Track Expected PO Numbers'}</h3>
          {editingId ? (
            <button className="secondary-button" type="button" onClick={resetForm}>
              Cancel
            </button>
          ) : null}
        </div>
        <p className="muted">Register PO numbers that should raise an alert when a matching receipt is posted.</p>
        {!!error ? <p style={{ color: '#b42318', marginBottom: '0.75rem' }}>{error}</p> : null}

        {editingId ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setError('');

              const payload = {
                poNumber: form.poNumber.trim(),
                jobId: form.jobId || null,
                note: form.note.trim()
              };

              startTransition(async () => {
                const result = await updateExpectedPurchaseOrder(editingId, payload);

                if (!result.ok || !result.data) {
                  setError(result.error ?? 'Unable to save tracked PO.');
                  return;
                }

                const updatedRow = result.data;
                setActiveRows((current) =>
                  current.map((entry) => (entry.id === updatedRow.id ? updatedRow : entry)).filter((entry) => isActiveAlertStatus(entry.status))
                );
                setInactiveRows((current) =>
                  current
                    .map((entry) => (entry.id === updatedRow.id ? updatedRow : entry))
                    .filter((entry) => !isActiveAlertStatus(entry.status))
                );
                resetForm();
                router.refresh();
              });
            }}
          >
            <label htmlFor="poNumber">PO Number</label>
            <input
              id="poNumber"
              value={form.poNumber}
              onChange={(event) => setForm((current) => ({ ...current, poNumber: event.target.value }))}
              required
              placeholder="6-2353-01"
            />

            <label htmlFor="jobId">Related Job</label>
            <select id="jobId" value={form.jobId} onChange={(event) => setForm((current) => ({ ...current, jobId: event.target.value }))}>
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
              value={form.note}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
              rows={3}
              placeholder="Optional context for this PO tracking entry."
            />

            <button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save PO Changes'}
            </button>
          </form>
        ) : (
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
        )}
      </section>

      <section className="card">
        <div className="section-title">
          <h3>Active Tracked PO Alerts</h3>
          <p className="muted">Matches sidebar badge logic (Open + Triggered).</p>
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
            {activeRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">No active tracked PO numbers.</td>
              </tr>
            ) : (
              activeRows.map((entry) => (
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
                    <button className="secondary-button" type="button" onClick={() => startEditing(entry)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="card">
        <div className="section-title">
          <h3>Inactive Tracked PO Alerts</h3>
          <p className="muted">Seen and resolved entries retained for history.</p>
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
            {inactiveRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">No seen or resolved tracked PO numbers.</td>
              </tr>
            ) : (
              inactiveRows.map((entry) => (
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {!editingId && combinedRows.length === 0 ? <p className="muted">No tracked PO numbers yet.</p> : null}
    </>
  );
}
