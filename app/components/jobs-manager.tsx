'use client';

import { useState, useTransition } from 'react';

import { JobRecord, JobStatus, createJob, deleteJob, updateJob } from '@/app/actions';

type JobFormState = Omit<JobRecord, 'id'>;

const emptyForm: JobFormState = {
  number: '',
  name: '',
  status: 'Open'
};

const statuses: JobStatus[] = ['Open', 'In Progress', 'On Hold', 'Completed'];

export function JobsManager({
  initialJobs,
  usingFallback
}: {
  initialJobs: JobRecord[];
  usingFallback: boolean;
}) {
  const [jobs, setJobs] = useState<JobRecord[]>(initialJobs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<JobFormState>(emptyForm);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  }

  function normalizeJobForm(payload: JobFormState): JobFormState {
    return {
      number: payload.number.trim(),
      name: payload.name.trim(),
      status: statuses.includes(payload.status) ? payload.status : 'Open'
    };
  }

  return (
    <>
      <section className="card">
        <div className="section-title">
          <h3>{editingId ? 'Edit Job' : 'Create Job'}</h3>
          {editingId && (
            <button className="secondary-button" type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
        {usingFallback && <p className="muted">Database is unavailable. Displaying demo jobs only; edits are disabled.</p>}
        {!!error && <p className="muted">{error}</p>}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setError('');

            const normalizedForm = normalizeJobForm(form);

            if (usingFallback) {
              setError('Job updates are disabled until the database connection is restored.');
              return;
            }

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

                const updatedJob = result.data;
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

                const createdJob = result.data;
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
                {status}
              </option>
            ))}
          </select>

          <button type="submit" disabled={isPending || usingFallback}>
            {isPending ? 'Saving...' : editingId ? 'Save Job' : 'Add Job'}
          </button>
        </form>
      </section>

      <section className="card">
        <div className="section-title">
          <h3>Jobs</h3>
          <button className="secondary-button" type="button" onClick={resetForm}>
            Add Job
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Job Number</th>
              <th>Job Name</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>{job.number}</td>
                <td>{job.name}</td>
                <td>{job.status}</td>
                <td>
                  <div className="row-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={usingFallback}
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
                      disabled={isPending || usingFallback}
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
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
