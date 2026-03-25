'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  createExpectedPurchaseOrder,
  ExpectedPurchaseOrderRecord,
  JobRecord,
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState({ poNumber: '', jobId: '', note: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const beginEdit = (entry: ExpectedPurchaseOrderRecord) => {
    setEditingId(entry.id);
    setFormState({
      poNumber: entry.poNumber,
      jobId: entry.jobId ?? '',
      note: entry.note ?? ''
    });
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormState({ poNumber: '', jobId: '', note: '' });
    setError(null);
  };

  const saveEdit = (id: string) => {
    startTransition(async () => {
      const result = await updateExpectedPurchaseOrder(id, {
        poNumber: formState.poNumber,
        jobId: formState.jobId || null,
        note: formState.note
      });

      if (!result.ok) {
        setError(result.error ?? 'Unable to update tracked PO right now.');
        return;
      }

      setSuccess('Tracked PO updated successfully.');
      setError(null);
      cancelEdit();
      router.refresh();
    });
  };

  return (
    <>
      {error ? <p style={{ color: '#b42318', marginBottom: '0.75rem' }}>{error}</p> : null}
      {success ? <p style={{ color: '#027a48', marginBottom: '0.75rem' }}>{success}</p> : null}
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
              trackedPurchaseOrders.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <AlertStatusBadge status={entry.status} />
                    <div className="muted">Triggered {entry.triggerCount} time(s)</div>
                  </td>
                  <td>{editingId === entry.id ? <input value={formState.poNumber} onChange={(event) => setFormState((current) => ({ ...current, poNumber: event.target.value }))} /> : (
                    <>
                      {entry.poNumber}
                      <div className="muted">Normalized: {entry.normalizedPoNumber}</div>
                    </>
                  )}</td>
                  <td>{editingId === entry.id ? (
                    <select value={formState.jobId} onChange={(event) => setFormState((current) => ({ ...current, jobId: event.target.value }))}>
                      <option value="">No related job</option>
                      {jobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.number} — {job.name}
                        </option>
                      ))}
                    </select>
                  ) : entry.jobLabel}</td>
                  <td>{editingId === entry.id ? <textarea rows={2} value={formState.note} onChange={(event) => setFormState((current) => ({ ...current, note: event.target.value }))} /> : (entry.note || '—')}</td>
                  <td>{entry.lastTriggeredAt ? new Date(entry.lastTriggeredAt).toLocaleString() : '—'}</td>
                  <td>{entry.latestAlertMessage || 'Awaiting matching receipt.'}</td>
                  <td>{new Date(entry.createdAt).toLocaleString()}</td>
                  <td>
                    {editingId === entry.id ? (
                      <div className="row-actions">
                        <button className="secondary-button" type="button" onClick={() => cancelEdit()} disabled={isPending}>
                          Cancel
                        </button>
                        <button type="button" onClick={() => saveEdit(entry.id)} disabled={isPending}>
                          {isPending ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    ) : (
                      <button className="secondary-button" type="button" onClick={() => beginEdit(entry)} disabled={isPending}>
                        Edit
                      </button>
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
