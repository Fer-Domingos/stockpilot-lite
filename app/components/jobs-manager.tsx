'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import * as actions from '@/app/actions';
import type { JobRecord, JobStatus } from '@/app/actions';
import { AppRole } from '@/lib/demo-data';
import { canManageInventory } from '@/lib/permissions';

const { createJob, deleteJob, updateJob } = actions;

type ImportJobsResult = {
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount?: number;
  message?: string;
};

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
  const router = useRouter();
  const [jobs, setJobs] = useState<JobRecord[]>(initialJobs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<JobFormState>(emptyForm);
  const [error, setError] = useState('');
  const [importError, setImportError] = useState('');
  const [importSummary, setImportSummary] = useState<ImportJobsResult | null>(null);
  const importFormRef = useRef<HTMLFormElement>(null);
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
      {!isReadOnly ? (
        <section className="card">
          <div className="section-title">
            <h3>Import Jobs (.xlsx)</h3>
          </div>
          <p className="muted">Upload an Excel workbook to add or update jobs in bulk.</p>
          {!!importError ? <p className="muted">{importError}</p> : null}
          {importSummary ? (
            <p className="muted">
              Import complete. Created: {importSummary.createdCount}, Updated: {importSummary.updatedCount}, Skipped:{' '}
              {importSummary.skippedCount}
              {typeof importSummary.errorCount === 'number' ? `, Errors: ${importSummary.errorCount}` : ''}
              {importSummary.message ? ` — ${importSummary.message}` : ''}
            </p>
          ) : null}
          <form
            ref={importFormRef}
            onSubmit={(event) => {
              event.preventDefault();
              setImportError('');
              setImportSummary(null);

              const formData = new FormData(event.currentTarget);
              const fileEntry = formData.get('jobsFile');
              const file = fileEntry instanceof File ? fileEntry : null;

              if (!file || !file.name) {
                setImportError('Please choose an .xlsx file to import.');
                return;
              }

              if (!file.name.toLowerCase().endsWith('.xlsx')) {
                setImportError('Only .xlsx files are supported.');
                return;
              }

              startTransition(async () => {
                try {
                  const importedActions = await import('@/app/actions');
                  const importJobsFromExcel = (
                    importedActions as {
                      importJobsFromExcel?: (
                        file: File,
                      ) => Promise<{ ok: boolean; error?: string; data?: ImportJobsResult }>;
                    }
                  ).importJobsFromExcel;

                  if (!importJobsFromExcel) {
                    setImportError('Job import is currently unavailable. Please contact support.');
                    return;
                  }

                  const result = await importJobsFromExcel(file);

                  if (!result.ok) {
                    setImportError(result.error ?? 'Import failed. Please verify the file and try again.');
                    return;
                  }

                  setImportSummary(
                    result.data ?? {
                      createdCount: 0,
                      updatedCount: 0,
                      skippedCount: 0,
                      message: 'Import finished.',
                    },
                  );
                  importFormRef.current?.reset();
                  router.refresh();
                } catch (caughtError) {
                  console.error('Failed to import jobs from Excel:', caughtError);
                  setImportError('Unexpected import error. Please try again.');
                }
              });
            }}
          >
            <label htmlFor="jobsFile">Excel file</label>
            <input id="jobsFile" name="jobsFile" type="file" accept=".xlsx" required />
            <button type="submit" disabled={isPending}>
              {isPending ? 'Importing...' : 'Import Jobs'}
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
