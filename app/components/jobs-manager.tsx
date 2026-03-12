'use client';

import { useState } from 'react';

import { JobStatus, ManagedJob, useDemoStore } from '@/lib/demo-store';

type JobFormState = Omit<ManagedJob, 'id'>;

const emptyForm: JobFormState = {
  number: '',
  name: '',
  status: 'Open'
};

const statuses: JobStatus[] = ['Open', 'In Progress', 'On Hold', 'Completed'];

export function JobsManager() {
  const { jobs, addJob, updateJob, deleteJob } = useDemoStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<JobFormState>(emptyForm);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
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
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (editingId) {
              updateJob(editingId, form);
            } else {
              addJob(form);
            }
            resetForm();
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

          <button type="submit">{editingId ? 'Save Job' : 'Add Job'}</button>
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
                      onClick={() => {
                        setEditingId(job.id);
                        setForm({ number: job.number, name: job.name, status: job.status });
                      }}
                    >
                      Edit
                    </button>
                    <button className="danger-button" type="button" onClick={() => deleteJob(job.id)}>
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
