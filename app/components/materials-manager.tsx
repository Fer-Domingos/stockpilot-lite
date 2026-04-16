'use client';

import { useMemo, useState, useTransition } from 'react';

import {
  MaterialImportPreview,
  MaterialImportRowInput,
  MaterialRecord,
  createMaterial,
  deleteMaterial,
  importMaterials,
  listMaterials,
  previewMaterialsImport,
  updateMaterial
} from '@/app/actions';
import { AppRole } from '@/lib/demo-data';
import { canManageInventory } from '@/lib/permissions';

type MaterialFormState = {
  name: string;
  sku: string;
  unit: string;
  minStockInput: string;
  notes: string;
};

const emptyForm: MaterialFormState = {
  name: '',
  sku: '',
  unit: 'UNIT',
  minStockInput: '',
  notes: ''
};

const unitOptions = ['UNIT', 'SHEETS'] as const;
const importTemplateHeader = 'name,sku,unit,minimumStock,notes';
const importTemplateRows = [
  'PLYWOOD 3/4 4X8 ROYAL BIRCH,BIRD34R,SHEETS,10,Royal birch standard panel',
  'MELAMINE 6MM 49X97 MAJESTIC WHITE W100 2S SUEDE MDF,MEL14WH2F,SHEETS,20,White melamine royal',
  'ARMORITE EXT 1 49X97,CFEXT1A,SHEETS,5,Exterior panel'
];

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseMaterialsCsv(content: string): { rows: MaterialImportRowInput[]; error?: string } {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '');

  if (lines.length === 0) {
    return { rows: [], error: 'CSV is empty.' };
  }

  const header = parseCsvLine(lines[0]).map((value) => value.toLowerCase());
  const expected = ['name', 'sku', 'unit', 'minimumstock', 'notes'];
  const hasExpectedHeader =
    header.length === expected.length && header.every((value, index) => value === expected[index]);

  if (!hasExpectedHeader) {
    return {
      rows: [],
      error: 'Invalid template header. Expected columns: name,sku,unit,minimumStock,notes.'
    };
  }

  const rows = lines.slice(1).map((line, index) => {
    const [name = '', sku = '', unit = '', minimumStock = '', notes = ''] = parseCsvLine(line);
    return {
      rowNumber: index + 2,
      name,
      sku,
      unit,
      minimumStock,
      notes
    };
  });

  return { rows };
}

export function MaterialsManager({
  initialMaterials,
  role
}: {
  initialMaterials: MaterialRecord[];
  role: AppRole;
}) {
  const [materials, setMaterials] = useState<MaterialRecord[]>(initialMaterials);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MaterialFormState>(emptyForm);
  const [error, setError] = useState<string>('');
  const [importError, setImportError] = useState<string>('');
  const [importSuccess, setImportSuccess] = useState<string>('');
  const [importRows, setImportRows] = useState<MaterialImportRowInput[]>([]);
  const [importPreview, setImportPreview] = useState<MaterialImportPreview | null>(null);
  const [allowUpdatesBySku, setAllowUpdatesBySku] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();
  const isReadOnly = !canManageInventory(role);

  const submitLabel = useMemo(() => {
    if (isPending) {
      return editingId ? 'Saving...' : 'Creating...';
    }

    return editingId ? 'Save Material' : 'Create Material';
  }, [editingId, isPending]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setError('');
  }

  function normalizeFormData(payload: MaterialFormState) {
    return {
      name: payload.name.trim(),
      sku: payload.sku.trim(),
      unit: payload.unit.trim().toUpperCase(),
      minStock:
        payload.minStockInput.trim() === ''
          ? null
          : Math.max(0, Math.floor(Number(payload.minStockInput))),
      notes: payload.notes.trim()
    };
  }

  function downloadTemplate() {
    const template = `${importTemplateHeader}\n${importTemplateRows.join('\n')}\n`;
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'materials-import-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {!isReadOnly ? (
        <section className="card">
          <div className="section-title">
            <h3>{editingId ? 'Edit Material' : 'Create Material'}</h3>
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

              const normalizedForm = normalizeFormData(form);
              const currentEditingId = editingId;

              startTransition(async () => {
                if (currentEditingId) {
                  const result = await updateMaterial(currentEditingId, normalizedForm);
                  if (!result.ok) {
                    setError(result.error ?? 'Failed to save material.');
                    return;
                  }

                  if (!result.data) {
                    setError('Material was updated but could not be loaded.');
                    return;
                  }

                  const updatedMaterial = result.data;
                  setMaterials((current) =>
                    current.map((material) => (material.id === currentEditingId ? updatedMaterial : material))
                  );
                  resetForm();
                } else {
                  const result = await createMaterial(normalizedForm);
                  if (!result.ok) {
                    setError(result.error ?? '');
                    return;
                  }

                  if (!result.data) {
                    setError('Material was saved but could not be loaded.');
                    return;
                  }

                  const createdMaterial = result.data;
                  setMaterials((current) => [...current, createdMaterial]);
                  resetForm();
                }
              });
            }}
          >
            <label htmlFor="materialName">Material Name</label>
            <input
              id="materialName"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
            />

            <label htmlFor="sku">SKU</label>
            <input
              id="sku"
              value={form.sku}
              onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))}
            />

            <label htmlFor="unit">Unit</label>
            <select
              id="unit"
              value={form.unit}
              onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}
              required
            >
              {unitOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <label htmlFor="minimumStock">Minimum Stock</label>
            <input
              id="minimumStock"
              type="number"
              min="0"
              value={form.minStockInput}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  minStockInput: event.target.value
                }))
              }
            />
            <p className="muted">Optional. Leave blank if this material should not use low stock alerts.</p>

            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              rows={3}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Supplier details, substitutions, handling notes..."
            />

            <button type="submit" disabled={isPending}>
              {submitLabel}
            </button>
          </form>
        </section>
      ) : null}

      {!isReadOnly ? (
        <section className="card">
          <div className="section-title">
            <h3>Import Materials</h3>
          </div>
          <p className="muted">
            Upload a CSV using the template. Required columns: <strong>name</strong> and <strong>unit</strong>.
          </p>
          {!!importError ? <p className="muted">{importError}</p> : null}
          {!!importSuccess ? <p className="muted">{importSuccess}</p> : null}
          <div className="row-actions import-actions">
            <button type="button" className="secondary-button" onClick={downloadTemplate}>
              Download Template
            </button>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                setImportError('');
                setImportSuccess('');
                setImportPreview(null);
                setImportRows([]);

                if (!file) {
                  return;
                }

                const content = await file.text();
                const parsed = parseMaterialsCsv(content);

                if (parsed.error) {
                  setImportError(parsed.error);
                  return;
                }

                if (parsed.rows.length === 0) {
                  setImportError('No material rows found in CSV.');
                  return;
                }

                setImportRows(parsed.rows);
              }}
            />
            <label className="import-checkbox">
              <input
                type="checkbox"
                checked={allowUpdatesBySku}
                onChange={(event) => setAllowUpdatesBySku(event.target.checked)}
              />
              Update existing materials when SKU already exists
            </label>
            <button
              type="button"
              onClick={() => {
                setImportError('');
                setImportSuccess('');

                if (importRows.length === 0) {
                  setImportError('Upload a valid CSV before previewing import.');
                  return;
                }

                startTransition(async () => {
                  const result = await previewMaterialsImport(importRows, allowUpdatesBySku);
                  if (!result.ok || !result.data) {
                    setImportError(result.error ?? 'Failed to preview material import.');
                    return;
                  }

                  setImportPreview(result.data);
                });
              }}
              disabled={isPending}
            >
              {isPending ? 'Preparing Preview...' : 'Import Materials'}
            </button>
          </div>

          {importPreview ? (
            <div className="table-scroll import-preview-table">
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Name</th>
                    <th>SKU</th>
                    <th>Action</th>
                    <th>Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.rows.map((row) => (
                    <tr key={`${row.rowNumber}-${row.sku}`}>
                      <td>{row.rowNumber}</td>
                      <td>{row.name || '—'}</td>
                      <td>{row.sku || '—'}</td>
                      <td>
                        {row.action === 'CREATE' ? 'Ready to import' : null}
                        {row.action === 'UPDATE' ? `Will update ${row.existingMaterialSku}` : null}
                        {row.action === 'ERROR' ? 'Error' : null}
                      </td>
                      <td>{row.errors.length > 0 ? row.errors.join(' ') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted import-summary">
                Ready to import: {importPreview.summary.readyToImport} | Will update: {importPreview.summary.toUpdate} |
                Errors: {importPreview.summary.withErrors}
              </p>
              <button
                type="button"
                disabled={isPending || importPreview.summary.withErrors > 0}
                onClick={() => {
                  setImportError('');
                  setImportSuccess('');

                  startTransition(async () => {
                    const result = await importMaterials(importRows, allowUpdatesBySku);

                    if (!result.ok || !result.data) {
                      setImportError(result.error ?? 'Failed to import materials.');
                      return;
                    }

                    const materialsResult = await listMaterials();
                    setMaterials(materialsResult.data);
                    setImportSuccess(
                      `Import complete. Created ${result.data.createdCount} and updated ${result.data.updatedCount} materials.`
                    );
                    setImportRows([]);
                    setImportPreview(null);
                  });
                }}
              >
                {isPending ? 'Importing...' : 'Confirm Import'}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="card">
        <div className="section-title">
          <h3>Materials Master</h3>
          {!isReadOnly ? (
            <button type="button" className="secondary-button" onClick={resetForm}>
              Add Material
            </button>
          ) : null}
        </div>
        {isReadOnly ? <p className="muted">PM access is read-only. Material management actions are hidden.</p> : null}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Material Name</th>
                <th>SKU</th>
                <th>Unit</th>
                <th>Minimum Stock</th>
                <th>Notes</th>
                {!isReadOnly ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {materials.map((material) => (
                <tr key={material.id}>
                  <td>{material.name}</td>
                  <td>{material.sku}</td>
                  <td>{material.unit}</td>
                  <td>{material.minStock ?? '—'}</td>
                  <td>{material.notes || '—'}</td>
                  {!isReadOnly ? (
                    <td>
                      <div className="row-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => {
                            setEditingId(material.id);
                            setForm({
                              name: material.name,
                              sku: material.sku,
                              unit: unitOptions.includes(material.unit as (typeof unitOptions)[number]) ? material.unit : 'UNIT',
                              minStockInput: material.minStock === null ? '' : String(material.minStock),
                              notes: material.notes
                            });
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
                              const result = await deleteMaterial(material.id);

                              if (!result.ok) {
                                setError(result.error ?? 'Failed to delete material.');
                                return;
                              }

                              setMaterials((current) => current.filter((entry) => entry.id !== material.id));
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
        </div>
      </section>
    </>
  );
}
