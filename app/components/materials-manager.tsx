'use client';

import { useMemo, useState, useTransition } from 'react';

import { MaterialRecord, createMaterial, deleteMaterial, updateMaterial } from '@/app/actions';
import { AppRole } from '@/lib/demo-data';
import { canManageInventory } from '@/lib/permissions';

type MaterialFormState = Omit<MaterialRecord, 'id' | 'quantity'>;

const emptyForm: MaterialFormState = {
  name: '',
  sku: '',
  unit: 'UNIT',
  minStock: 0,
  notes: ''
};

const unitOptions = ['UNIT', 'SHEETS'] as const;

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

  function normalizeFormData(payload: MaterialFormState): MaterialFormState {
    return {
      name: payload.name.trim(),
      sku: payload.sku.trim(),
      unit: payload.unit.trim().toUpperCase(),
      minStock: Math.max(0, Math.floor(payload.minStock)),
      notes: payload.notes.trim()
    };
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

              startTransition(async () => {
                if (editingId) {
                  const result = await updateMaterial(editingId, normalizedForm);
                  if (!result.ok) {
                    setError(result.error ?? 'Failed to save material.');
                    return;
                  }

                  if (!result.data) {
                    setError('Material was updated but could not be loaded.');
                    return;
                  }

                  const updatedMaterial = result.data;
                  setMaterials((current) => current.map((material) => (material.id === editingId ? updatedMaterial : material)));
                } else {
                  const result = await createMaterial(normalizedForm);
                  if (!result.ok) {
                    setError(result.error ?? 'Failed to create material.');
                    return;
                  }

                  if (!result.data) {
                    setError('Material was saved but could not be loaded.');
                    return;
                  }

                  const createdMaterial = result.data;
                  setMaterials((current) => [...current, createdMaterial]);
                }

                resetForm();
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
              required
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
              value={form.minStock}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  minStock: Number(event.target.value)
                }))
              }
              required
            />

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
                  <td>{material.minStock}</td>
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
                              minStock: material.minStock,
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
