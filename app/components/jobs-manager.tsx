'use client';

import { useState, useTransition } from 'react';

import { JobRecord, JobStatus, createJob, deleteJob, importJobsFromExcel, listJobs, updateJob } from '@/app/actions';
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
  role
}: {
  initialJobs: JobRecord[];
  role: AppRole;
}) {
  const [jobs, setJobs] = useState<JobRecord[]>(initialJobs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<JobFormState>(emptyForm);
  const [error, setError] = useState('');
  const [importSummary, setImportSummary] = useState<{
    totalRowsRead: number;
    imported: number;
    skippedDuplicates: number;
    invalidRows: number;
    errors: string[];
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const isReadOnly = !canManageInventory(role);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  }

  async function refreshJobsList() {
    const result = await listJobs();
    setJobs(result.data);
  }

  function normalizeJobForm(payload: JobFormState): JobFormState {
    return {
      number: payload.number.trim(),
      name: payload.name.trim(),
      status: statuses.includes(payload.status) ? payload.status : 'OPEN'
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
              setImportSummary(null);

              const normalizedForm = normalizeJobForm(form);
              const currentEditingId = editingId;

              startTransition(async () => {
                if (currentEditingId) {
                  const result = await updateJob(currentEditingId, normalizedForm);

                  if (!result.ok) {
                    setError(result.error ?? 'Failed to update job.');
                    return;
                  }

                  if (!result.data) {
                    setError('Job was updated but could not be loaded.');
                    return;
                  }

                  const updatedJob = result.data;
                  setJobs((current) => current.map((job) => (job.id === currentEditingId ? updatedJob : job)));
                  resetForm();
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
                  resetForm();
                }
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
        {!isReadOnly ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setError('');
              setImportSummary(null);

              const formElement = event.currentTarget;
              const fileInput = formElement.elements.namedItem('jobsImportFile') as HTMLInputElement | null;
              const file = fileInput?.files?.[0];

              if (!file) {
                setError('Please select an .xlsx file before importing.');
                return;
              }

              startTransition(async () => {
                const result = await importJobsFromExcel(file);

                if (!result.ok) {
                  setError(result.error ?? 'Failed to import jobs.');
                  return;
                }

                if (!result.data) {
                  setError('Import completed, but summary details were unavailable.');
                  return;
                }

                setImportSummary(result.data);
                await refreshJobsList();
                formElement.reset();
              });
            }}
          >
            <label htmlFor="jobsImportFile">Import Jobs (.xlsx)</label>
            <div className="row-actions">
              <input id="jobsImportFile" name="jobsImportFile" type="file" accept=".xlsx" required />
              <button className="secondary-button" type="submit" disabled={isPending}>
                {isPending ? 'Importing...' : 'Import Jobs'}
              </button>
            </div>
          </form>
        ) : null}
        {importSummary ? (
          <div className="card" style={{ marginTop: '1rem' }}>
            <h4 style={{ marginTop: 0 }}>Import Summary</h4>
            <p className="muted">Total rows read: {importSummary.totalRowsRead}</p>
            <p className="muted">Imported: {importSummary.imported}</p>
            <p className="muted">Skipped duplicates: {importSummary.skippedDuplicates}</p>
            <p className="muted">Invalid rows: {importSummary.invalidRows}</p>
            <p className="muted">Errors: {importSummary.errors.length}</p>
            {importSummary.errors.length > 0 ? (
              <ul>
                {importSummary.errors.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
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
