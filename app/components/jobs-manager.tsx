'use client';

import { useState, useTransition } from 'react';

import { JobRecord, JobStatus, createJob, deleteJob, listJobs, updateJob } from '@/app/actions';
import { AppRole } from '@/lib/demo-data';
import { canManageInventory } from '@/lib/permissions';

type JobFormState = Omit<JobRecord, 'id'>;

const emptyForm: JobFormState = {
  number: '',
  name: '',
  status: 'OPEN'
};

const statuses: JobStatus[] = ['OPEN', 'CLOSED'];

export function JobsManager({
  initialJobs,
  role,
  importJobsFromExcel
}: {
  initialJobs: JobRecord[];
  role: AppRole;
  importJobsFromExcel: (file: File) => Promise<{ ok: boolean; error?: string; data?: unknown }>;
}) {
  const [jobs, setJobs] = useState<JobRecord[]>(initialJobs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<JobFormState>(emptyForm);
  const [error, setError] = useState('');
  const [importError, setImportError] = useState('');
  const [importSummary, setImportSummary] = useState<{
    created?: number;
    updated?: number;
    skipped?: number;
    total?: number;
    message?: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const isReadOnly = !canManageInventory(role);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  }

  function normalizeJobForm(payload: JobFormState): JobFormState {
    return {
      number: payload.number.trim(),
      name: payload.name.trim(),
      status: statuses.includes(payload.status) ? payload.status : 'OPEN'
    };
  }

  function normalizeImportSummary(payload: unknown) {
    if (!payload || typeof payload !== 'object') {
      return {
        message: 'Jobs import finished successfully.'
      };
    }

    const summary = payload as Record<string, unknown>;
    const created = typeof summary.created === 'number' ? summary.created : undefined;
    const updated = typeof summary.updated === 'number' ? summary.updated : undefined;
    const skipped = typeof summary.skipped === 'number' ? summary.skipped : undefined;
    const total = typeof summary.total === 'number' ? summary.total : undefined;
    const message = typeof summary.message === 'string' ? summary.message : undefined;

    return { created, updated, skipped, total, message };
  }

  return (
    <>
      {!isReadOnly ? (
        <section className="card">
          <div className="section-title">
            <h3>Import Jobs (Excel)</h3>
          </div>
          <p className="muted">Upload a validated Excel file to create/update jobs in bulk.</p>
          {!!importError && <p className="muted">{importError}</p>}
          {importSummary ? (
            <p className="muted">
              {importSummary.message ?? 'Jobs imported successfully.'}
              {typeof importSummary.total === 'number' ? ` Total: ${importSummary.total}.` : ''}
              {typeof importSummary.created === 'number' ? ` Created: ${importSummary.created}.` : ''}
              {typeof importSummary.updated === 'number' ? ` Updated: ${importSummary.updated}.` : ''}
              {typeof importSummary.skipped === 'number' ? ` Skipped: ${importSummary.skipped}.` : ''}
            </p>
          ) : null}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setImportError('');
              setImportSummary(null);
              const formElement = event.currentTarget;

              const formData = new FormData(formElement);
              const upload = formData.get('jobsImportFile');

              if (!(upload instanceof File) || upload.size === 0) {
                setImportError('Please choose an Excel file to import.');
                return;
              }

              startTransition(async () => {
                const result = await importJobsFromExcel(upload);

                if (!result.ok) {
                  setImportError(result.error ?? 'Unable to import jobs right now.');
                  return;
                }

                setImportSummary(normalizeImportSummary(result.data));

                const latest = await listJobs();
                setJobs(latest.data);

                formElement.reset();
              });
            }}
          >
            <label htmlFor="jobsImportFile">Excel file</label>
            <input id="jobsImportFile" name="jobsImportFile" type="file" accept=".xlsx,.xls" required />
            <button type="submit" disabled={isPending}>
              {isPending ? 'Importing...' : 'Import Jobs'}
            </button>
          </form>
        </section>
      ) : null}

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
