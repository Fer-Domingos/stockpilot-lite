'use client';

import { useMemo, useState } from 'react';

import { JobRecord, MaterialRecord, receiveMaterialsFromInvoice } from '@/app/actions';

type DestinationType = 'SHOP' | 'JOB';

type UploadResponse = {
  fileName: string;
  url: string;
  error?: string;
};

type ExtractedLine = {
  qty: string;
  code: string;
  description: string;
};

type ExtractResponse = {
  vendor: string;
  invoiceRef: string;
  lines: ExtractedLine[];
  error?: string;
};

type ParsedRow = {
  id: string;
  quantity: string;
  code: string;
  description: string;
  materialId: string | null;
  destinationType: DestinationType;
  jobId: string;
  confirmed: boolean;
};

const maxSizeMb = 10;
const acceptedTypes = ['application/pdf'];

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchMaterial(code: string, description: string, materials: MaterialRecord[]) {
  const normalizedCode = code.trim().toUpperCase();
  if (normalizedCode) {
    const skuMatch = materials.find((material) => material.sku.toUpperCase() === normalizedCode);
    if (skuMatch) {
      return skuMatch;
    }
  }

  const normalizedDescription = normalizeText(description);
  if (!normalizedDescription) {
    return null;
  }

  let bestMatch: MaterialRecord | null = null;
  let bestScore = 0;

  for (const material of materials) {
    const normalizedName = normalizeText(material.name);
    if (!normalizedName) {
      continue;
    }

    const nameTokens = normalizedName.split(' ').filter(Boolean);
    const score = nameTokens.filter((token) => normalizedDescription.includes(token)).length;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = material;
    }
  }

  return bestScore > 0 ? bestMatch : null;
}

export function InvoiceImportReceiveForm({ materials, jobs }: { materials: MaterialRecord[]; jobs: JobRecord[] }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedInvoice, setUploadedInvoice] = useState<UploadResponse | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openJobs = useMemo(() => jobs.filter((job) => job.status === 'OPEN'), [jobs]);

  function updateRow(id: string, updater: (row: ParsedRow) => ParsedRow) {
    setRows((currentRows) => currentRows.map((row) => (row.id === id ? updater(row) : row)));
  }

  async function handleUploadAndExtract() {
    if (!selectedFile) {
      setError('Select a PDF invoice to upload.');
      return;
    }

    if (!acceptedTypes.includes(selectedFile.type)) {
      setError('Only PDF invoices are supported for auto-import.');
      return;
    }

    if (selectedFile.size > maxSizeMb * 1024 * 1024) {
      setError('Invoice file must be 10MB or smaller.');
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const uploadResponse = await fetch('/api/invoices/upload', {
        method: 'POST',
        body: formData
      });

      const uploadPayload = (await uploadResponse.json()) as UploadResponse;
      if (!uploadResponse.ok || !uploadPayload.url || !uploadPayload.fileName) {
        throw new Error(uploadPayload.error ?? 'Upload failed.');
      }

      setUploadedInvoice({ fileName: uploadPayload.fileName, url: uploadPayload.url });

      const extractResponse = await fetch('/api/invoices/extract-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: uploadPayload.url })
      });

      const extractPayload = (await extractResponse.json()) as ExtractResponse;
      if (!extractResponse.ok) {
        throw new Error(extractPayload.error ?? 'Failed to extract invoice text.');
      }

      const parsedRows = extractPayload.lines.map((line, index) => {
        const matchedMaterial = matchMaterial(line.code, line.description, materials);
        return {
          id: `row-${index}`,
          quantity: line.qty,
          code: line.code,
          description: line.description,
          materialId: matchedMaterial?.id ?? null,
          destinationType: 'SHOP' as const,
          jobId: '',
          confirmed: Boolean(matchedMaterial && Number(line.qty) > 0)
        };
      });

      setRows(parsedRows);
      setVendorName(extractPayload.vendor ?? '');
      setInvoiceNumber(extractPayload.invoiceRef ?? '');

      if (parsedRows.length === 0) {
        setError('No stock lines were found in the uploaded invoice.');
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to process invoice.');
      setRows([]);
    } finally {
      setIsUploading(false);
    }
  }

  const confirmedRows = rows.filter((row) => row.confirmed);

  return (
    <form
      action={receiveMaterialsFromInvoice}
      onSubmit={(event) => {
        const payload = confirmedRows.map((row) => ({
          originalLine: `${row.quantity} | ${row.code} | ${row.description}`,
          materialId: row.materialId,
          quantity: row.quantity,
          unit: row.materialId ? materials.find((material) => material.id === row.materialId)?.unit ?? 'UNIT' : 'UNIT',
          destinationType: row.destinationType,
          jobId: row.destinationType === 'JOB' ? row.jobId : '',
          invoiceNumber,
          vendorName
        }));

        if (payload.length === 0) {
          event.preventDefault();
          setError('Select at least one confirmed row to post.');
          return;
        }

        const hiddenInput = event.currentTarget.elements.namedItem('rowsPayload');
        if (!(hiddenInput instanceof HTMLInputElement)) {
          event.preventDefault();
          setError('Unable to submit parsed rows.');
          return;
        }

        hiddenInput.value = JSON.stringify(payload);
        setIsSubmitting(true);
      }}
    >
      <label htmlFor="invoiceFile">Upload Invoice PDF</label>
      <input
        id="invoiceFile"
        name="invoiceFile"
        type="file"
        accept=".pdf,application/pdf"
        onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
      />

      <button type="button" onClick={handleUploadAndExtract} disabled={isUploading} style={{ marginTop: '0.5rem' }}>
        {isUploading ? 'Uploading & Processing...' : 'Upload Invoice'}
      </button>

      {uploadedInvoice ? (
        <p className="muted" style={{ marginTop: '0.5rem' }}>
          Uploaded: <a href={uploadedInvoice.url}>{uploadedInvoice.fileName}</a>
        </p>
      ) : null}

      <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))', marginTop: '0.75rem' }}>
        <div>
          <label htmlFor="invoiceNumber">Invoice/Ref</label>
          <input
            id="invoiceNumber"
            value={invoiceNumber}
            onChange={(event) => setInvoiceNumber(event.target.value)}
            placeholder="Auto-filled from invoice when found"
          />
        </div>
        <div>
          <label htmlFor="vendorName">Vendor</label>
          <input
            id="vendorName"
            value={vendorName}
            onChange={(event) => setVendorName(event.target.value)}
            placeholder="Auto-filled from invoice when found"
          />
        </div>
      </div>

      <input type="hidden" name="rowsPayload" />

      {error ? <p style={{ color: '#b42318', marginBottom: '0.75rem' }}>{error}</p> : null}

      {rows.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Confirm</th>
              <th>Qty</th>
              <th>Code</th>
              <th>Description</th>
              <th>Material</th>
              <th>Job</th>
              <th>Destination</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    type="checkbox"
                    disabled={!row.materialId}
                    checked={row.confirmed}
                    onChange={(event) => updateRow(row.id, (current) => ({ ...current, confirmed: event.target.checked }))}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="1"
                    value={row.quantity}
                    onChange={(event) =>
                      updateRow(row.id, (current) => ({
                        ...current,
                        quantity: event.target.value,
                        confirmed: Boolean(current.materialId) && Number(event.target.value) > 0
                      }))
                    }
                  />
                </td>
                <td>{row.code}</td>
                <td>{row.description}</td>
                <td>
                  <select
                    value={row.materialId ?? ''}
                    onChange={(event) =>
                      updateRow(row.id, (current) => ({
                        ...current,
                        materialId: event.target.value || null,
                        confirmed: Boolean(event.target.value) && Number(current.quantity) > 0
                      }))
                    }
                  >
                    <option value="">Select material</option>
                    {materials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.name} ({material.sku})
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={row.jobId}
                    disabled={row.destinationType !== 'JOB'}
                    onChange={(event) => updateRow(row.id, (current) => ({ ...current, jobId: event.target.value }))}
                  >
                    <option value="">Select job</option>
                    {openJobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.number} — {job.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={row.destinationType}
                    onChange={(event) =>
                      updateRow(row.id, (current) => ({
                        ...current,
                        destinationType: event.target.value as DestinationType,
                        jobId: event.target.value === 'JOB' ? current.jobId : ''
                      }))
                    }
                  >
                    <option value="SHOP">SHOP</option>
                    <option value="JOB">JOB</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">Upload a PDF invoice to generate receiving lines for review.</p>
      )}

      <button type="submit" disabled={isSubmitting} style={{ marginTop: '0.75rem' }}>
        {isSubmitting ? 'Posting...' : `Post ${confirmedRows.length} Confirmed Row(s)`}
      </button>
    </form>
  );
}
