'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  JobImportSummary,
  JobRecord,
  JobStatus,
  createJob,
  deleteJob,
  importJobsFromExcel,
  updateJob
} from '@/app/actions';
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
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [importSummary, setImportSummary] = useState<JobImportSummary | null>(null);
  const [importError, setImportError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<JobFormState>(emptyForm);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const [isImportPending, startImportTransition] = useTransition();
  const router = useRouter();
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
            <h3>Import Jobs (.xlsx)</h3>
          </div>
          <p className="muted">Required columns: Job Number, Job Name. Optional: Status (OPEN/CLOSED).</p>
          {!!importError && <p className="muted">{importError}</p>}
          {importSummary ? (
            <div className="muted">
              <p>Total rows read: {importSummary.totalRowsRead}</p>
              <p>Imported: {importSummary.imported}</p>
              <p>Skipped duplicates: {importSummary.skippedDuplicates}</p>
              <p>Invalid rows: {importSummary.invalidRows}</p>
              <p>Errors: {importSummary.errors.length}</p>
              {importSummary.errors.length > 0 ? (
                <ul>
                  {importSummary.errors.slice(0, 10).map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setImportError('');
              setImportSummary(null);

              if (!selectedImportFile) {
                setImportError('Please select an XLSX file.');
                return;
              }

              startImportTransition(async () => {
                const result = await importJobsFromExcel(selectedImportFile);

                if (!result.ok || !result.data) {
                  setImportError(result.error ?? 'Import failed.');
                  return;
                }

                setImportSummary({
                  totalRowsRead: result.data.totalRowsRead,
                  imported: result.data.imported,
                  skippedDuplicates: result.data.skippedDuplicates,
                  invalidRows: result.data.invalidRows,
                  errors: result.data.errors
                });
                setJobs(result.data.jobs);
                setSelectedImportFile(null);
                router.refresh();
              });
            }}
          >
            <label htmlFor="jobsImportFile">Excel File</label>
            <input
              id="jobsImportFile"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => setSelectedImportFile(event.target.files?.[0] ?? null)}
              disabled={isImportPending}
            />
            <button type="submit" disabled={isImportPending}>
              {isImportPending ? 'Importing...' : 'Import Jobs'}
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
