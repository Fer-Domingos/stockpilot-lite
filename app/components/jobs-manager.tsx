'use client';

import { useState, useTransition } from 'react';

import { JobRecord, JobStatus, bulkCreateJobs, createJob, deleteJob, updateJob } from '@/app/actions';
import { AppRole } from '@/lib/demo-data';
import { canManageInventory } from '@/lib/permissions';

type JobFormState = Omit<JobRecord, 'id'>;

const emptyForm: JobFormState = {
  number: '',
  name: '',
  status: 'OPEN'
};

const statuses: JobStatus[] = ['OPEN', 'CLOSED'];

function toComparableChunks(value: string): Array<number | string> {
  return value
    .trim()
    .split(/(\d+)/)
    .filter((part) => part.length > 0)
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part.toLowerCase()));
}

function compareJobNumbers(leftNumber: string, rightNumber: string): number {
  const leftChunks = toComparableChunks(leftNumber);
  const rightChunks = toComparableChunks(rightNumber);
  const maxLength = Math.max(leftChunks.length, rightChunks.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftChunk = leftChunks[index];
    const rightChunk = rightChunks[index];

    if (leftChunk === undefined) {
      return -1;
    }

    if (rightChunk === undefined) {
      return 1;
    }

    if (typeof leftChunk === 'number' && typeof rightChunk === 'number') {
      if (leftChunk !== rightChunk) {
        return leftChunk - rightChunk;
      }
      continue;
    }

    const leftValue = String(leftChunk);
    const rightValue = String(rightChunk);
    const valueComparison = leftValue.localeCompare(rightValue);
    if (valueComparison !== 0) {
      return valueComparison;
    }
  }

  return 0;
}

function sortJobsByNumber(jobEntries: JobRecord[]): JobRecord[] {
  return [...jobEntries].sort((left, right) => compareJobNumbers(left.number, right.number));
}

export function JobsManager({
  initialJobs,
  role
}: {
  initialJobs: JobRecord[];
  role: AppRole;
}) {
  const [jobs, setJobs] = useState<JobRecord[]>(() => sortJobsByNumber(initialJobs));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<JobFormState>(emptyForm);
  const [error, setError] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [bulkSummary, setBulkSummary] = useState('');
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

  function parseBulkJobs(text: string): {
    payloads: JobFormState[];
    invalidLines: string[];
  } {
    const payloads: JobFormState[] = [];
    const invalidLines: string[] = [];
    const lines = text.split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      const rawLine = lines[index];
      const line = rawLine.trim();

      if (!line) {
        continue;
      }

      const match = line.match(/^(\S+)(?:\s*(?:\||-)\s*|\s+)(.+)$/);
      if (!match) {
        invalidLines.push(`Line ${index + 1}: ${line}`);
        continue;
      }

      const number = match[1]?.trim() ?? '';
      const name = match[2]?.trim() ?? '';
      if (!number || !name) {
        invalidLines.push(`Line ${index + 1}: ${line}`);
        continue;
      }

      payloads.push({
        number,
        name,
        status: 'OPEN'
      });
    }

    return { payloads, invalidLines };
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
                  setJobs((current) =>
                    sortJobsByNumber(current.map((job) => (job.id === currentEditingId ? updatedJob : job)))
                  );
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
                  setJobs((current) => sortJobsByNumber([...current, createdJob]));
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
      {!isReadOnly ? (
        <section className="card">
          <div className="section-title">
            <h3>Bulk Add Jobs</h3>
          </div>
          <p className="muted">Paste one job per line using formats like &quot;6-2533 | Job Name&quot;.</p>
          {!!bulkSummary && <p className="muted">{bulkSummary}</p>}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setBulkSummary('');

              const { payloads, invalidLines } = parseBulkJobs(bulkInput);

              startTransition(async () => {
                const result = await bulkCreateJobs(payloads);

                if (!result.ok || !result.data) {
                  setBulkSummary(result.error ?? 'Failed to import jobs.');
                  return;
                }

                const createdJobs = result.data.createdJobs;
                const existingJobNumbers = result.data.existingJobNumbers;
                const invalidEntries = [...invalidLines, ...result.data.invalidEntries];

                if (createdJobs.length > 0) {
                  setJobs((current) => sortJobsByNumber([...current, ...createdJobs]));
                }

                const summaryParts = [
                  `${createdJobs.length} jobs created`,
                  `${existingJobNumbers.length} skipped (already existed)`,
                  `${invalidEntries.length} invalid lines skipped`
                ];

                const detailParts: string[] = [];
                if (existingJobNumbers.length > 0) {
                  detailParts.push(`Existing: ${existingJobNumbers.join(', ')}`);
                }
                if (invalidEntries.length > 0) {
                  detailParts.push(`Invalid: ${invalidEntries.join(', ')}`);
                }

                setBulkSummary(
                  `${summaryParts.join(' • ')}${detailParts.length ? ` | ${detailParts.join(' | ')}` : ''}`
                );
                setBulkInput('');
              });
            }}
          >
            <label htmlFor="bulkJobsInput">Paste jobs (one per line)</label>
            <textarea
              id="bulkJobsInput"
              rows={8}
              value={bulkInput}
              onChange={(event) => setBulkInput(event.target.value)}
              placeholder="6-2533 | Design Within Reach at Tivoli"
            />
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
