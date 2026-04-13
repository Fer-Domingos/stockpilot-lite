'use client';

import { Fragment, useMemo, useState, useTransition } from 'react';

import {
  JobRecord,
  MaterialRecord,
  createMaterialFromInvoiceImport,
  receiveMaterialsFromInvoice
} from '@/app/actions';

type DestinationType = 'SHOP' | 'JOB';
type RowStatus = 'GOOD' | 'REVIEW' | 'IGNORED';

type ParsedRow = {
  id: string;
  originalLine: string;
  quantity: string;
  unit: string;
  materialId: string | null;
  confirmed: boolean;
  status: RowStatus;
};

type CreateMaterialDraft = {
  name: string;
  sku: string;
  unit: string;
  minStockInput: string;
  notes: string;
};

const quantityPattern = /(?:^|\s)(\d+(?:\.\d+)?)(?:\s|$)/;
const ignoreLinePattern = /\b(?:handling|tax|freight|subtotal|total)\b/i;

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

function classifyLine(line: string, quantity: string) {
  if (ignoreLinePattern.test(line)) {
    return 'IGNORED' as const;
  }

  const cleaned = normalizeText(buildSuggestedMaterialName(line));
  const words = cleaned.split(' ').filter(Boolean);
  const hasDecentDescription = words.length >= 2 && cleaned.length >= 8;

  if (quantity && hasDecentDescription) {
    return 'GOOD' as const;
  }

  return 'REVIEW' as const;
}

function parseInvoiceText(rawText: string, materials: MaterialRecord[]) {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map((line, index) => {
    const matchedMaterial = matchMaterial(line, materials);
    const quantity = parseQuantity(line);
    const status = classifyLine(line, quantity);

    return {
      id: `row-${index}`,
      originalLine: line,
      quantity,
      unit: parseUnit(line, matchedMaterial?.unit ?? 'UNIT'),
      materialId: matchedMaterial?.id ?? null,
      confirmed: status === 'GOOD' && Boolean(matchedMaterial) && Boolean(quantity),
      status
    };
  });
}

function statusColor(status: RowStatus) {
  if (status === 'GOOD') {
    return '#067647';
  }
  if (status === 'IGNORED') {
    return '#667085';
  }
  return '#b54708';
}

export function InvoiceImportReceiveForm({ materials, jobs }: { materials: MaterialRecord[]; jobs: JobRecord[] }) {
  const [invoiceText, setInvoiceText] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [availableMaterials, setAvailableMaterials] = useState<MaterialRecord[]>(materials);
  const [activeCreateRowId, setActiveCreateRowId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CreateMaterialDraft | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [destinationType, setDestinationType] = useState<DestinationType>('SHOP');
  const [jobId, setJobId] = useState('');
  const [isCreatingMaterial, startCreateTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openJobs = useMemo(() => jobs.filter((job) => job.status === 'OPEN'), [jobs]);

  function handleParse() {
    const parsedRows = parseInvoiceText(invoiceText, availableMaterials);
    setRows(parsedRows);
    setError(null);
  }

  function handleGenerateCleanLines() {
    const cleanedText = invoiceText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => !ignoreLinePattern.test(line))
      .join('\n');

    setInvoiceText(cleanedText);
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

  const selectedRows = rows.filter((row) => row.confirmed && row.status !== 'IGNORED' && row.materialId);

  return (
    <form
      action={receiveMaterialsFromInvoice}
      onSubmit={(event) => {
        const payload = selectedRows.map((row) => ({
          originalLine: row.originalLine,
          materialId: row.materialId,
          quantity: row.quantity,
          unit: row.unit,
          destinationType,
          jobId: destinationType === 'JOB' ? jobId : '',
          invoiceNumber,
          vendorName
        }));

        if (payload.length === 0) {
          event.preventDefault();
          setError('Select at least one valid row to post.');
          return;
        }

        if (destinationType === 'JOB' && !jobId) {
          event.preventDefault();
          setError('Select a job when destination is JOB.');
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
      <section style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Invoice Input</h3>
        <label htmlFor="invoiceText">Paste Invoice Text</label>
        <textarea
          id="invoiceText"
          rows={8}
          value={invoiceText}
          onChange={(event) => setInvoiceText(event.target.value)}
          placeholder="Paste lines copied from an invoice here..."
        />
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button type="button" onClick={handleParse}>
            Parse Invoice
          </button>
          <button type="button" className="secondary-button" onClick={handleGenerateCleanLines}>
            Generate Clean Lines
          </button>
        </div>
      </section>

      <section style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Invoice Info</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))',
            gap: '0.75rem',
            alignItems: 'end'
          }}
        >
          <div>
            <label htmlFor="vendorName">Vendor</label>
            <input id="vendorName" value={vendorName} onChange={(event) => setVendorName(event.target.value)} />
          </div>
          <div>
            <label htmlFor="invoiceNumber">Invoice #</label>
            <input id="invoiceNumber" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} />
          </div>
          <div>
            <label htmlFor="destinationType">Destination</label>
            <select
              id="destinationType"
              value={destinationType}
              onChange={(event) => {
                const nextDestination = event.target.value as DestinationType;
                setDestinationType(nextDestination);
                if (nextDestination !== 'JOB') {
                  setJobId('');
                }
              }}
            >
              <option value="SHOP">SHOP</option>
              <option value="JOB">JOB</option>
            </select>
          </div>
          <div>
            <label htmlFor="jobId">Job</label>
            <select id="jobId" value={jobId} disabled={destinationType !== 'JOB'} onChange={(event) => setJobId(event.target.value)}>
              <option value="">Select job</option>
              {openJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.number} — {job.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <input type="hidden" name="rowsPayload" />

      {error ? <p style={{ color: '#b42318', marginBottom: '0.75rem' }}>{error}</p> : null}

      <section>
        <h3 style={{ marginBottom: '0.5rem' }}>Detected Lines</h3>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setRows((current) =>
                current.map((row) =>
                  row.status === 'GOOD' && row.materialId && Number(row.quantity) > 0 ? { ...row, confirmed: true } : row
                )
              );
            }}
          >
            Confirm All Good
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              setRows((current) => current.map((row) => (row.confirmed ? { ...row, status: 'IGNORED', confirmed: false } : row)))
            }
          >
            Ignore Selected
          </button>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Posting...' : `Post Selected Rows (${selectedRows.length})`}
          </button>
        </div>

        {rows.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Confirm</th>
                <th>Quantity</th>
                <th>Description</th>
                <th>Material</th>
                <th>Unit</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <tr>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.confirmed}
                        disabled={row.status === 'IGNORED'}
                        onChange={(event) =>
                          updateRow(row.id, (current) => ({
                            ...current,
                            confirmed: event.target.checked
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(event) =>
                          updateRow(row.id, (current) => {
                            const nextQuantity = event.target.value;
                            const nextStatus = classifyLine(current.originalLine, nextQuantity);
                            return {
                              ...current,
                              quantity: nextQuantity,
                              status: current.status === 'IGNORED' ? 'IGNORED' : nextStatus,
                              confirmed:
                                current.status === 'IGNORED'
                                  ? false
                                  : current.confirmed && Boolean(current.materialId) && Number(nextQuantity) > 0
                            };
                          })
                        }
                        placeholder="Qty"
                      />
                    </td>
                    <td>{row.originalLine}</td>
                    <td>
                      <select
                        value={row.materialId ?? ''}
                        onChange={(event) =>
                          updateRow(row.id, (current) => ({
                            ...current,
                            materialId: event.target.value || null,
                            unit: availableMaterials.find((material) => material.id === event.target.value)?.unit ?? current.unit,
                            confirmed: current.confirmed && Boolean(event.target.value)
                          }))
                        }
                      >
                        <option value="">No match</option>
                        {availableMaterials.map((material) => (
                          <option key={material.id} value={material.id}>
                            {material.name} ({material.sku})
                          </option>
                        ))}
                      </select>
                      {!row.materialId ? (
                        <div style={{ marginTop: '0.4rem' }}>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => openCreateMaterial(row)}
                            disabled={isCreatingMaterial}
                          >
                            Create Material
                          </button>
                        </div>
                      ) : null}
                    </td>
                    <td>{row.unit}</td>
                    <td>
                      <span style={{ color: statusColor(row.status), fontWeight: 600 }}>{row.status}</span>
                    </td>
                  </tr>
                  {activeCreateRowId === row.id && draft ? (
                    <tr>
                      <td colSpan={6}>
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
                                onChange={(event) =>
                                  setDraft((current) => (current ? { ...current, name: event.target.value } : null))
                                }
                                placeholder="Material name"
                              />
                            </div>
                            <div>
                              <label htmlFor={`${row.id}-sku`}>SKU (optional)</label>
                              <input
                                id={`${row.id}-sku`}
                                value={draft.sku}
                                onChange={(event) =>
                                  setDraft((current) => (current ? { ...current, sku: event.target.value } : null))
                                }
                                placeholder="Optional SKU"
                              />
                            </div>
                            <div>
                              <label htmlFor={`${row.id}-unit`}>Unit</label>
                              <select
                                id={`${row.id}-unit`}
                                value={draft.unit}
                                onChange={(event) =>
                                  setDraft((current) => (current ? { ...current, unit: event.target.value } : null))
                                }
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
                                onChange={(event) =>
                                  setDraft((current) => (current ? { ...current, notes: event.target.value } : null))
                                }
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
                                    confirmed: current.status !== 'IGNORED' && Number(current.quantity) > 0
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
          <p className="muted">Parsed rows will appear here for manual review and posting.</p>
        )}
      </section>
    </form>
  );
}
