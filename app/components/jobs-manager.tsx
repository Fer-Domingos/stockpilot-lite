'use client';

import { useState, useTransition } from 'react';

import { JobRecord, JobStatus, createJob, deleteJob, updateJob } from '@/app/actions';
import { AppRole } from '@/lib/demo-data';
import { canManageInventory } from '@/lib/permissions';

type JobFormState = Omit<JobRecord, 'id'>;

const emptyForm: JobFormState = {
  number: '',
  name: '',
  status: 'OPEN'
};

const statuses: JobStatus[] = ['OPEN', 'CLOSED'];

function toSafeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toSafeStatus(value: unknown): JobStatus {
  return statuses.includes(value as JobStatus) ? (value as JobStatus) : 'OPEN';
}

function sanitizeJobRecord(job: Partial<JobRecord> | null | undefined): JobRecord | null {
  if (!job || typeof job.id !== 'string' || !job.id.trim()) {
    return null;
  }

  return {
    id: job.id,
    number: toSafeString(job.number),
    name: toSafeString(job.name),
    status: toSafeStatus(job.status)
  };
}

export function JobsManager({
  initialJobs,
  role
}: {
  initialJobs: JobRecord[];
  role: AppRole;
}) {
  const [jobs, setJobs] = useState<JobRecord[]>(() =>
    (Array.isArray(initialJobs) ? initialJobs : [])
      .map((job) => sanitizeJobRecord(job))
      .filter((job): job is JobRecord => job !== null)
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<JobFormState>(emptyForm);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const isReadOnly = !canManageInventory(role);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  }

  function normalizeJobForm(payload: JobFormState): JobFormState {
    return {
      number: toSafeString(payload.number).trim(),
      name: toSafeString(payload.name).trim(),
      status: toSafeStatus(payload.status)
    };
  }

  return (
    <>
      {!isReadOnly ? (
        <section className="card">
          <div className="section-title">
            <h3>{editingId ? 'Edit Job' : 'Create Job'}</h3>
            {editingId && (
              <button className="secondary-button" type="button" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
          {!!error && <p className="muted">{error}</p>}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setError('');

              const normalizedForm = normalizeJobForm(form);

              startTransition(async () => {
                if (editingId) {
                  const result = await updateJob(editingId, normalizedForm);

                  if (!result.ok) {
                    setError(result.error ?? 'Failed to update job.');
                    return;
                  }

                  if (!result.data) {
                    setError('Job was updated but could not be loaded.');
                    return;
                  }

                  const updatedJob = sanitizeJobRecord(result.data);
                  if (!updatedJob) {
                    setError('Job was updated but returned invalid data.');
                    return;
                  }
                  setJobs((current) => current.map((job) => (job.id === editingId ? updatedJob : job)));
                } else {
                  const result = await createJob(normalizedForm);

                  if (!result.ok) {
                    setError(result.error ?? 'Failed to create job.');
                    return;
                  }

                  if (!result.data) {
                    setError('Job was created but could not be loaded.');
                    return;
                  }

                  const createdJob = sanitizeJobRecord(result.data);
                  if (!createdJob) {
                    setError('Job was created but returned invalid data.');
                    return;
                  }
                  setJobs((current) => [...current, createdJob]);
                }

                resetForm();
              });
            }}
          >
            <label htmlFor="jobNumber">Job Number</label>
            <input
              id="jobNumber"
              value={form.number}
              onChange={(event) => setForm((current) => ({ ...current, number: event.target.value }))}
              required
            />

            <label htmlFor="jobName">Job Name</label>
            <input
              id="jobName"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
            />

            <label htmlFor="jobStatus">Status</label>
            <select
              id="jobStatus"
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as JobStatus }))}
              required
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status === 'OPEN' ? 'Open' : 'Closed'}
                </option>
              ))}
            </select>

            <button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : editingId ? 'Save Job' : 'Add Job'}
            </button>
          </form>
        </section>
      ) : null}

      <section className="card">
        <div className="section-title">
          <h3>Jobs</h3>
          {!isReadOnly ? (
            <button className="secondary-button" type="button" onClick={resetForm}>
              Add Job
            </button>
          ) : null}
        </div>
        {isReadOnly ? <p className="muted">PM access is read-only. Job management actions are hidden.</p> : null}
        <table>
          <thead>
            <tr>
              <th>Job Number</th>
              <th>Job Name</th>
              <th>Status</th>
              {!isReadOnly ? <th>Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>{job.number}</td>
                <td>{job.name}</td>
                <td>{job.status === 'OPEN' ? 'Open' : 'Closed'}</td>
                {!isReadOnly ? (
                  <td>
                    <div className="row-actions">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => {
                          setEditingId(job.id);
                          setForm({ number: job.number, name: job.name, status: job.status });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="danger-button"
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          setError('');
                          startTransition(async () => {
                            const result = await deleteJob(job.id);

                          if (!result.ok) {
                            setError(result.error ?? 'Failed to delete job.');
                            return;
                          }

                          setJobs((current) => current.filter((entry) => entry.id !== job.id));
                          });
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
