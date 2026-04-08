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
  parsedDescription: string;
  suggestedMaterialName: string;
  matchConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNMATCHED';
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
const lineIgnorePattern =
  /\b(?:invoice|inv|date|subtotal|tax|total|balance|payment|terms|due|remit|ship to|bill to)\b/i;
const quantityHintPatterns = [
  /\bqty(?:uantity)?\.?\s*[:x-]?\s*(\d+(?:\.\d+)?)\b/i,
  /\b(\d+(?:\.\d+)?)\s*(?:x|ea|each|pcs?|units?|sheets?)\b/i,
  /\b(?:ea|each|pcs?|units?|sheets?)\s*(\d+(?:\.\d+)?)\b/i
];
const quantityUnitsPattern = /\b(?:ea|each|unit|units|sheet|sheets|pcs|pc|x)\b/gi;
const ignoredTokens = new Set([
  'and',
  'for',
  'with',
  'the',
  'from',
  'invoice',
  'item',
  'material',
  'stock',
  'job',
  'qty'
]);

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function getMeaningfulTokens(value: string) {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 1 && !ignoredTokens.has(token) && !/^\d+$/.test(token));
}

function parseQuantity(line: string) {
  for (const pattern of quantityHintPatterns) {
    const match = line.match(pattern);
    if (!match) {
      continue;
    }

    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return String(Math.floor(parsed));
    }
  }

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
  const withoutQty = line
    .replace(/\bqty(?:uantity)?\.?\s*[:x-]?\s*\d+(?:\.\d+)?\b/gi, ' ')
    .replace(/\b\d+(?:\.\d+)?\s*(?:x|ea|each|pcs?|units?|sheets?)\b/gi, ' ')
    .replace(/\b(?:ea|each|pcs?|units?|sheets?)\s*\d+(?:\.\d+)?\b/gi, ' ')
    .replace(quantityPattern, ' ');
  const withoutDecorators = withoutQty
    .replace(quantityUnitsPattern, ' ')
    .replace(/\$?\d+\.\d{2}\b/g, ' ')
    .replace(/\b\d{5,}\b/g, ' ')
    .replace(/\b[A-Z0-9]{2,}-[A-Z0-9-]+\b/g, ' ')
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
      return { material: skuMatch, confidence: 'HIGH' as const };
    }
  }

  const descriptionTokens = getMeaningfulTokens(line);
  if (descriptionTokens.length === 0) {
    return { material: null, confidence: 'UNMATCHED' as const };
  }

  let bestMatch: MaterialRecord | null = null;
  let bestScore = 0;

  for (const material of materials) {
    const nameTokens = getMeaningfulTokens(material.name);
    if (nameTokens.length === 0) {
      continue;
    }

    const overlap = nameTokens.filter((token) => descriptionTokens.includes(token)).length;
    if (overlap === 0) {
      continue;
    }

    const coverageScore = overlap / nameTokens.length;
    const precisionScore = overlap / descriptionTokens.length;
    const score = coverageScore * 0.7 + precisionScore * 0.3;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = material;
    }
  }

  if (!bestMatch) {
    return { material: null, confidence: 'UNMATCHED' as const };
  }

  if (bestScore >= 0.85) {
    return { material: bestMatch, confidence: 'HIGH' as const };
  }

  if (bestScore >= 0.55) {
    return { material: bestMatch, confidence: 'MEDIUM' as const };
  }

  return { material: bestMatch, confidence: 'LOW' as const };
}

function parseInvoiceText(rawText: string, materials: MaterialRecord[]) {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !lineIgnorePattern.test(line));

  return lines.map((line, index) => {
    const parsedDescription = buildSuggestedMaterialName(line);
    const matchResult = matchMaterial(parsedDescription, materials);
    const matchedMaterial = matchResult.material;
    const quantity = parseQuantity(line);

    return {
      id: `row-${index}`,
      originalLine: line,
      parsedDescription,
      suggestedMaterialName: matchedMaterial?.name ?? parsedDescription,
      matchConfidence: matchResult.confidence,
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
  const [invoiceText, setInvoiceText] = useState('');
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
                    <div>
                      <select
                        value={row.materialId ?? ''}
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
                        <option value="">Select material…</option>
                        {availableMaterials.map((material) => (
                          <option key={material.id} value={material.id}>
                            {material.name} ({material.sku})
                          </option>
                        ))}
                      </select>
                      <p className="muted" style={{ marginBottom: '0.5rem' }}>
                        Suggested: {row.suggestedMaterialName || 'No suggestion'} ({row.matchConfidence})
                      </p>
                      {!row.materialId ? (
                        <div>
                          <span style={{ color: '#b42318', marginRight: '0.5rem' }}>No confirmed match</span>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => openCreateMaterial(row)}
                            disabled={isCreatingMaterial}
                          >
                            Create Material
                          </button>
                          <p className="muted" style={{ marginBottom: 0 }}>
                            Select an existing material or create a new one.
                          </p>
                        </div>
                      ) : (
                        <p className="muted" style={{ marginBottom: 0 }}>
                          Parsed description: {row.parsedDescription}
                        </p>
                      )}
                    </div>
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
