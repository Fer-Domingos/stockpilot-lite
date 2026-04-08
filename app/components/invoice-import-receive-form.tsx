'use client';

import { Fragment, useMemo, useState, useTransition } from 'react';

import {
  JobRecord,
  MaterialRecord,
  createMaterialFromInvoiceImport,
  receiveMaterialsFromInvoice
} from '@/app/actions';

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

type CreateMaterialDraft = {
  name: string;
  sku: string;
  unit: string;
  minStockInput: string;
  notes: string;
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

function buildSuggestedMaterialName(line: string) {
  const withoutQty = line.replace(quantityPattern, ' ');
  const withoutDecorators = withoutQty
    .replace(/\b(?:ea|each|unit|units|sheet|sheets|pcs|pc|x)\b/gi, ' ')
    .replace(/[()\[\],]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!withoutDecorators) {
    return line.trim();
  }

  return withoutDecorators;
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
      confirmed: Boolean(matchedMaterial && quantity)
    };
  });
}

export function InvoiceImportReceiveForm({ materials, jobs }: { materials: MaterialRecord[]; jobs: JobRecord[] }) {
  const scannedPdfMessage =
    'This PDF appears to be scanned (image-based). Please paste the invoice text manually or upload a text-based PDF.';
  const [invoiceText, setInvoiceText] = useState('');
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  const [extractMessage, setExtractMessage] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [availableMaterials, setAvailableMaterials] = useState<MaterialRecord[]>(materials);
  const [activeCreateRowId, setActiveCreateRowId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CreateMaterialDraft | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreatingMaterial, startCreateTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openJobs = useMemo(() => jobs.filter((job) => job.status === 'OPEN'), [jobs]);

  function handleParse() {
    const parsedRows = parseInvoiceText(invoiceText, availableMaterials);
    setRows(parsedRows);
    setError(null);
  }

  async function handleExtractText() {
    if (!selectedPdf) {
      setExtractMessage('Please choose a PDF file first.');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedPdf);

    setIsExtracting(true);
    setExtractMessage('Extracting text from PDF...');

    try {
      const response = await fetch('/api/invoices/extract-text', {
        method: 'POST',
        body: formData
      });

      const payload = (await response.json()) as { text?: string; error?: string };

      if (!response.ok || !payload.text) {
        if (payload.error === 'No text could be extracted from this PDF.') {
          setExtractMessage(scannedPdfMessage);
        } else {
          setExtractMessage(payload.error ?? 'Unable to extract text from this PDF.');
        }
        return;
      }

      setInvoiceText(payload.text);
      setRows([]);
      setError(null);
      setExtractMessage('Text extracted. Review and edit as needed, then click Parse Invoice.');
    } catch (extractError) {
      console.error('Failed to extract PDF text:', extractError);
      setExtractMessage('Unable to extract text from this PDF.');
    } finally {
      setIsExtracting(false);
    }
  }

  function updateRow(id: string, updater: (row: ParsedRow) => ParsedRow) {
    setRows((currentRows) => currentRows.map((row) => (row.id === id ? updater(row) : row)));
  }

  function openCreateMaterial(row: ParsedRow) {
    setActiveCreateRowId(row.id);
    setCreateError(null);
    setDraft({
      name: buildSuggestedMaterialName(row.originalLine),
      sku: '',
      unit: row.unit,
      minStockInput: '',
      notes: `Created from invoice line: ${row.originalLine}`
    });
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
          vendorName: row.vendorName
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
      <label htmlFor="receiveInvoicePdf">Invoice PDF (text-based)</label>
      <input
        id="receiveInvoicePdf"
        type="file"
        accept="application/pdf,.pdf"
        onChange={(event) => {
          setSelectedPdf(event.target.files?.[0] ?? null);
          setExtractMessage(null);
        }}
      />

      <button type="button" className="secondary-button" onClick={handleExtractText} disabled={!selectedPdf || isExtracting}>
        {isExtracting ? 'Extracting...' : 'Upload and Extract Text'}
      </button>

      {extractMessage ? <p className="muted">{extractMessage}</p> : null}

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
              <Fragment key={row.id}>
                <tr key={row.id}>
                  <td>
                    <input
                      type="checkbox"
                      disabled={!row.materialId}
                      checked={row.confirmed}
                      onChange={(event) =>
                        updateRow(row.id, (current) => ({ ...current, confirmed: event.target.checked }))
                      }
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
                            unit:
                              availableMaterials.find((material) => material.id === event.target.value)?.unit ??
                              current.unit,
                            confirmed: Boolean(event.target.value) && Boolean(current.quantity)
                          }))
                        }
                      >
                        {availableMaterials.map((material) => (
                          <option key={material.id} value={material.id}>
                            {material.name} ({material.sku})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div>
                        <span style={{ color: '#b42318', marginRight: '0.5rem' }}>No match</span>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => openCreateMaterial(row)}
                          disabled={isCreatingMaterial}
                        >
                          Create Material
                        </button>
                        <p className="muted" style={{ marginBottom: 0 }}>
                          Review and edit before creating.
                        </p>
                      </div>
                    )}
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
                          jobId: event.target.value === 'JOB' ? current.jobId : ''
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
                {activeCreateRowId === row.id && draft ? (
                  <tr>
                    <td colSpan={9}>
                      <div style={{ border: '1px solid #d0d5dd', borderRadius: '6px', padding: '0.75rem' }}>
                        <p style={{ marginTop: 0, marginBottom: '0.5rem' }}>
                          Create new material for this line (review before saving).
                        </p>
                        {createError ? <p style={{ color: '#b42318' }}>{createError}</p> : null}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))',
                            gap: '0.5rem',
                            alignItems: 'end'
                          }}
                        >
                          <div>
                            <label htmlFor={`${row.id}-name`}>Material Name</label>
                            <input
                              id={`${row.id}-name`}
                              value={draft.name}
                              onChange={(event) => setDraft((current) => (current ? { ...current, name: event.target.value } : null))}
                              placeholder="Material name"
                            />
                          </div>
                          <div>
                            <label htmlFor={`${row.id}-sku`}>SKU (optional)</label>
                            <input
                              id={`${row.id}-sku`}
                              value={draft.sku}
                              onChange={(event) => setDraft((current) => (current ? { ...current, sku: event.target.value } : null))}
                              placeholder="Optional SKU"
                            />
                          </div>
                          <div>
                            <label htmlFor={`${row.id}-unit`}>Unit</label>
                            <select
                              id={`${row.id}-unit`}
                              value={draft.unit}
                              onChange={(event) => setDraft((current) => (current ? { ...current, unit: event.target.value } : null))}
                            >
                              <option value="UNIT">UNIT</option>
                              <option value="SHEETS">SHEETS</option>
                            </select>
                          </div>
                          <div>
                            <label htmlFor={`${row.id}-minstock`}>Minimum Stock (optional)</label>
                            <input
                              id={`${row.id}-minstock`}
                              type="number"
                              min="0"
                              value={draft.minStockInput}
                              onChange={(event) =>
                                setDraft((current) => (current ? { ...current, minStockInput: event.target.value } : null))
                              }
                              placeholder="Optional"
                            />
                          </div>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <label htmlFor={`${row.id}-notes`}>Notes (optional)</label>
                            <input
                              id={`${row.id}-notes`}
                              value={draft.notes}
                              onChange={(event) => setDraft((current) => (current ? { ...current, notes: event.target.value } : null))}
                              placeholder="Optional notes"
                            />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                          <button
                            type="button"
                            disabled={isCreatingMaterial}
                            onClick={() => {
                              const currentDraft = draft;
                              if (!currentDraft) {
                                return;
                              }

                              setCreateError(null);

                              startCreateTransition(async () => {
                                const result = await createMaterialFromInvoiceImport({
                                  name: currentDraft.name,
                                  sku: currentDraft.sku,
                                  unit: currentDraft.unit,
                                  minStock:
                                    currentDraft.minStockInput.trim() === ''
                                      ? null
                                      : Number(currentDraft.minStockInput),
                                  notes: currentDraft.notes
                                });

                                if (!result.ok || !result.data) {
                                  setCreateError(result.error ?? 'Failed to create material.');
                                  return;
                                }

                                const createdMaterial = result.data;
                                setAvailableMaterials((current) => [...current, createdMaterial]);
                                updateRow(row.id, (current) => ({
                                  ...current,
                                  materialId: createdMaterial.id,
                                  unit: createdMaterial.unit,
                                  confirmed: Boolean(current.quantity)
                                }));
                                setActiveCreateRowId(null);
                                setDraft(null);
                              });
                            }}
                          >
                            {isCreatingMaterial ? 'Creating...' : 'Save Material'}
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={isCreatingMaterial}
                            onClick={() => {
                              setActiveCreateRowId(null);
                              setDraft(null);
                              setCreateError(null);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">Parsed rows will appear here for review before posting.</p>
      )}
    </form>
  );
}
