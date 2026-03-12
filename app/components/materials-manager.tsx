'use client';

import { useState } from 'react';

import { ManagedMaterial, useDemoStore } from '@/lib/demo-store';

type MaterialFormState = Omit<ManagedMaterial, 'id'>;

const emptyForm: MaterialFormState = {
  name: '',
  sku: '',
  unit: '',
  minStock: 0,
  notes: ''
};

export function MaterialsManager() {
  const { materials, addMaterial, updateMaterial, deleteMaterial } = useDemoStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MaterialFormState>(emptyForm);

  const submitLabel = editingId ? 'Save Material' : 'Create Material';

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  return (
    <>
      <section className="card">
        <div className="section-title">
          <h3>{editingId ? 'Edit Material' : 'Create Material'}</h3>
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
              updateMaterial(editingId, form);
            } else {
              addMaterial(form);
            }
            resetForm();
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
          <input
            id="unit"
            value={form.unit}
            onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}
            placeholder="Each, Sheets, Pairs..."
            required
          />

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

          <button type="submit">{submitLabel}</button>
        </form>
      </section>

      <section className="card">
        <div className="section-title">
          <h3>Materials Master</h3>
          <button type="button" className="secondary-button" onClick={resetForm}>
            Add Material
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Material Name</th>
              <th>SKU</th>
              <th>Unit</th>
              <th>Minimum Stock</th>
              <th>Notes</th>
              <th>Actions</th>
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
                          unit: material.unit,
                          minStock: material.minStock,
                          notes: material.notes
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button className="danger-button" type="button" onClick={() => deleteMaterial(material.id)}>
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
