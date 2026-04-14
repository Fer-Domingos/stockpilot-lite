'use client';

import { useMemo, useState } from 'react';

import { JobRecord, MaterialRecord, receiveMaterialsManual } from '@/app/actions';

type DestinationType = 'SHOP' | 'JOB';

type ReceiptLine = {
  id: string;
  materialId: string;
  quantity: string;
  destinationType: DestinationType;
  jobId: string;
};

function createLine(index: number, destinationType: DestinationType, jobId: string): ReceiptLine {
  return {
    id: `line-${Date.now()}-${index}`,
    materialId: '',
    quantity: '',
    destinationType,
    jobId
  };
}

export function ReceiveMaterialForm({ materials, jobs }: { materials: MaterialRecord[]; jobs: JobRecord[] }) {
  const activeMaterials = useMemo(() => materials.filter((material) => material.isActive), [materials]);
  const defaultJobId = jobs[0]?.id ?? '';

  const [defaultDestination, setDefaultDestination] = useState<DestinationType>('SHOP');
  const [defaultJob, setDefaultJob] = useState<string>(defaultJobId);
  const [lines, setLines] = useState<ReceiptLine[]>([createLine(0, 'SHOP', defaultJobId)]);
  const [error, setError] = useState<string | null>(null);

  function updateLine(id: string, updater: (line: ReceiptLine) => ReceiptLine) {
    setLines((current) => current.map((line) => (line.id === id ? updater(line) : line)));
  }

  function addLine() {
    setLines((current) => [...current, createLine(current.length, defaultDestination, defaultJob)]);
  }

  function removeLine(id: string) {
    setLines((current) => {
      if (current.length <= 1) {
        return current;
      }
      return current.filter((line) => line.id !== id);
    });
  }

  return (
    <form
      action={receiveMaterialsManual}
      onSubmit={(event) => {
        const validLines = lines.filter((line) => {
          const hasMaterial = Boolean(line.materialId);
          const quantity = Math.floor(Number(line.quantity));
          const hasQuantity = Number.isFinite(quantity) && quantity > 0;
          const hasJob = line.destinationType === 'SHOP' || Boolean(line.jobId);
          return hasMaterial && hasQuantity && hasJob;
        });

        if (validLines.length === 0) {
          event.preventDefault();
          setError('Add at least one valid receipt line before posting.');
          return;
        }

        const hiddenInput = event.currentTarget.elements.namedItem('linesPayload');
        if (!(hiddenInput instanceof HTMLInputElement)) {
          event.preventDefault();
          setError('Unable to submit receipt lines.');
          return;
        }

        hiddenInput.value = JSON.stringify(validLines);
      }}
    >
      <label htmlFor="vendorName">Vendor</label>
      <input id="vendorName" name="vendorName" required placeholder="Northwest Plywood Supply" />

      <label htmlFor="invoiceNumber">Invoice / Ref</label>
      <input id="invoiceNumber" name="invoiceNumber" required placeholder="INV-100245" />

      <label htmlFor="defaultDestination">Destination Default</label>
      <select
        id="defaultDestination"
        value={defaultDestination}
        onChange={(event) => setDefaultDestination(event.target.value === 'JOB' ? 'JOB' : 'SHOP')}
      >
        <option value="SHOP">SHOP</option>
        <option value="JOB">JOB</option>
      </select>

      <label htmlFor="defaultJob">Job Default</label>
      <select id="defaultJob" value={defaultJob} onChange={(event) => setDefaultJob(event.target.value)}>
        <option value="">Select job</option>
        {jobs.map((job) => (
          <option key={job.id} value={job.id}>
            {job.number} — {job.name}
          </option>
        ))}
      </select>

      <label htmlFor="notes">Notes</label>
      <textarea id="notes" name="notes" rows={3} placeholder="Packing slip, condition, discrepancies..." />

      <h4 style={{ marginBottom: '0.5rem' }}>Receipt Lines</h4>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>SKU / Code</th>
              <th>Unit</th>
              <th>Quantity</th>
              <th>Destination</th>
              <th>Job</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const selectedMaterial = activeMaterials.find((material) => material.id === line.materialId) ?? null;

              return (
                <tr key={line.id}>
                  <td>
                    <select
                      value={line.materialId}
                      onChange={(event) =>
                        updateLine(line.id, (current) => ({
                          ...current,
                          materialId: event.target.value
                        }))
                      }
                    >
                      <option value="">Select material</option>
                      {activeMaterials.map((material) => (
                        <option key={material.id} value={material.id}>
                          {material.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{selectedMaterial?.sku ?? '—'}</td>
                  <td>{selectedMaterial?.unit ?? '—'}</td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(line.id, (current) => ({
                          ...current,
                          quantity: event.target.value
                        }))
                      }
                    />
                  </td>
                  <td>
                    <select
                      value={line.destinationType}
                      onChange={(event) =>
                        updateLine(line.id, (current) => ({
                          ...current,
                          destinationType: event.target.value === 'JOB' ? 'JOB' : 'SHOP',
                          jobId: event.target.value === 'JOB' ? current.jobId || defaultJob : ''
                        }))
                      }
                    >
                      <option value="SHOP">SHOP</option>
                      <option value="JOB">JOB</option>
                    </select>
                  </td>
                  <td>
                    <select
                      value={line.destinationType === 'JOB' ? line.jobId : ''}
                      disabled={line.destinationType !== 'JOB'}
                      onChange={(event) =>
                        updateLine(line.id, (current) => ({
                          ...current,
                          jobId: event.target.value
                        }))
                      }
                    >
                      <option value="">Select job</option>
                      {jobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.number} — {job.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button type="button" className="danger-button" onClick={() => removeLine(line.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <button type="button" className="secondary-button" onClick={addLine}>
          Add Line
        </button>
        <button type="submit">Post Receipt</button>
      </div>

      <input type="hidden" name="linesPayload" />
      {error ? <p style={{ color: '#b42318', marginTop: '0.75rem' }}>{error}</p> : null}
    </form>
  );
}
