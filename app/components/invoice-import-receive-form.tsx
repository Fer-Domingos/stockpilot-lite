'use client';

import { useMemo, useState } from 'react';

import { JobRecord, MaterialRecord, receiveMaterialsFromInvoice } from '@/app/actions';

type DestinationType = 'SHOP' | 'JOB';

type ParsedRow = {
  id: string;
  originalLine: string;
  quantity: string;
  unit: string;
  materialId: string | null;
  destinationType: DestinationType;
  jobId: string;
  invoiceNumber: string;
  vendorName: string;
  confirmed: boolean;
};

const quantityPattern = /(?:^|\s)(\d+(?:\.\d+)?)(?:\s|$)/;

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseQuantity(line: string) {
  const match = line.match(quantityPattern);
  if (!match) {
    return '';
  }

  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return '';
  }

  return String(Math.floor(parsed));
}

function parseUnit(line: string, fallback: string) {
  const normalized = line.toLowerCase();
  const knownUnits = ['sheet', 'sheets', 'unit', 'units', 'ea', 'each'];
  const explicit = knownUnits.find((entry) => normalized.includes(entry));
  if (explicit?.startsWith('sheet')) {
    return 'SHEETS';
  }
  if (explicit) {
    return 'UNIT';
  }
  return fallback;
}

function matchMaterial(line: string, materials: MaterialRecord[]) {
  const skuTokens = line.toUpperCase().match(/[A-Z0-9-]{3,}/g) ?? [];

  for (const token of skuTokens) {
    const skuMatch = materials.find((material) => material.sku.toUpperCase() === token);
    if (skuMatch) {
      return skuMatch;
    }
  }

  const normalizedLine = normalizeText(line);
  if (!normalizedLine) {
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
    const score = nameTokens.filter((token) => normalizedLine.includes(token)).length;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = material;
    }
  }

  return bestScore > 0 ? bestMatch : null;
}

function parseInvoiceText(rawText: string, materials: MaterialRecord[]) {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map((line, index) => {
    const matchedMaterial = matchMaterial(line, materials);
    const quantity = parseQuantity(line);

    return {
      id: `row-${index}`,
      originalLine: line,
      quantity,
      unit: parseUnit(line, matchedMaterial?.unit ?? 'UNIT'),
      materialId: matchedMaterial?.id ?? null,
      destinationType: 'SHOP' as const,
      jobId: '',
      invoiceNumber: '',
      vendorName: '',
      confirmed: Boolean(matchedMaterial && quantity),
    };
  });
}

export function InvoiceImportReceiveForm({ materials, jobs }: { materials: MaterialRecord[]; jobs: JobRecord[] }) {
  const [invoiceText, setInvoiceText] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openJobs = useMemo(() => jobs.filter((job) => job.status === 'OPEN'), [jobs]);

  function handleParse() {
    const parsedRows = parseInvoiceText(invoiceText, materials);
    setRows(parsedRows);
    setError(null);
  }

  function updateRow(id: string, updater: (row: ParsedRow) => ParsedRow) {
    setRows((currentRows) => currentRows.map((row) => (row.id === id ? updater(row) : row)));
  }

  const confirmedRows = rows.filter((row) => row.confirmed);

  return (
    <form
      action={receiveMaterialsFromInvoice}
      onSubmit={(event) => {
        const payload = confirmedRows.map((row) => ({
          originalLine: row.originalLine,
          materialId: row.materialId,
          quantity: row.quantity,
          unit: row.unit,
          destinationType: row.destinationType,
          jobId: row.destinationType === 'JOB' ? row.jobId : '',
          invoiceNumber: row.invoiceNumber,
          vendorName: row.vendorName,
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
      <label htmlFor="invoiceText">Paste Invoice Text</label>
      <textarea
        id="invoiceText"
        rows={8}
        value={invoiceText}
        onChange={(event) => setInvoiceText(event.target.value)}
        placeholder="Paste lines copied from an invoice here..."
      />

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" onClick={handleParse}>
          Parse Invoice
        </button>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Posting...' : `Post ${confirmedRows.length} Confirmed Row(s)`}
        </button>
      </div>

      <input type="hidden" name="rowsPayload" />

      {error ? <p style={{ color: '#b42318', marginBottom: '0.75rem' }}>{error}</p> : null}

      {rows.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Confirm</th>
              <th>Invoice Line</th>
              <th>Matched Material</th>
              <th>Quantity</th>
              <th>Unit</th>
              <th>Destination</th>
              <th>Job</th>
              <th>Invoice/Ref</th>
              <th>Vendor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={row.confirmed}
                    onChange={(event) => updateRow(row.id, (current) => ({ ...current, confirmed: event.target.checked }))}
                  />
                </td>
                <td>{row.originalLine}</td>
                <td>
                  {row.materialId ? (
                    <select
                      value={row.materialId}
                      onChange={(event) =>
                        updateRow(row.id, (current) => ({
                          ...current,
                          materialId: event.target.value || null,
                          unit: materials.find((material) => material.id === event.target.value)?.unit ?? current.unit,
                        }))
                      }
                    >
                      {materials.map((material) => (
                        <option key={material.id} value={material.id}>
                          {material.name} ({material.sku})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ color: '#b42318' }}>No match</span>
                  )}
                </td>
                <td>
                  <input
                    type="number"
                    min="1"
                    value={row.quantity}
                    onChange={(event) => updateRow(row.id, (current) => ({ ...current, quantity: event.target.value }))}
                    placeholder="Qty"
                  />
                </td>
                <td>{row.unit}</td>
                <td>
                  <select
                    value={row.destinationType}
                    onChange={(event) =>
                      updateRow(row.id, (current) => ({
                        ...current,
                        destinationType: event.target.value as DestinationType,
                        jobId: event.target.value === 'JOB' ? current.jobId : '',
                      }))
                    }
                  >
                    <option value="SHOP">SHOP</option>
                    <option value="JOB">JOB</option>
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
                  <input
                    value={row.invoiceNumber}
                    onChange={(event) =>
                      updateRow(row.id, (current) => ({ ...current, invoiceNumber: event.target.value }))
                    }
                    placeholder="Invoice/reference"
                  />
                </td>
                <td>
                  <input
                    value={row.vendorName}
                    onChange={(event) => updateRow(row.id, (current) => ({ ...current, vendorName: event.target.value }))}
                    placeholder="Vendor"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">Parsed rows will appear here for review before posting.</p>
      )}
    </form>
  );
}
