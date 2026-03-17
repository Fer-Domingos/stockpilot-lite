'use client';

import { JobRecord, MaterialRecord, receiveMaterial } from '@/app/actions';

export function ReceiveMaterialForm({ materials, jobs }: { materials: MaterialRecord[]; jobs: JobRecord[] }) {
  return (
    <form action={receiveMaterial}>
      <label htmlFor="materialId">Material</label>
      <select id="materialId" name="materialId" required>
        <option value="">Select material</option>
        {materials.map((material) => (
          <option value={material.id} key={material.id}>
            {material.name} ({material.sku})
          </option>
        ))}
      </select>

      <label htmlFor="destination">Destination</label>
      <select id="destination" name="destination" required defaultValue="SHOP">
        <option value="SHOP">SHOP (General Inventory)</option>
        {jobs.map((job) => (
          <option key={job.id} value={`JOB:${job.id}`}>
            JOB {job.number} — {job.name}
          </option>
        ))}
      </select>

      <p className="muted">Choose SHOP for general stock, or choose a JOB to receive directly into that job allocation.</p>

      <label htmlFor="invoiceNumber">Invoice Number</label>
      <input id="invoiceNumber" name="invoiceNumber" placeholder="INV-100245" />

      <label htmlFor="vendorName">Vendor / Supplier</label>
      <input id="vendorName" name="vendorName" placeholder="Northwest Plywood Supply" />

      <label htmlFor="notes">Receiving Notes</label>
      <textarea id="notes" name="notes" rows={3} placeholder="Condition, PO references, discrepancies..." />

      <label htmlFor="photoUrl">Photo URL (optional placeholder for upload)</label>
      <input id="photoUrl" name="photoUrl" type="url" placeholder="https://example.com/invoice-photo.jpg" />

      <label htmlFor="quantity">Quantity Received</label>
      <input id="quantity" name="quantity" type="number" min="1" required />

      <button type="submit">Post Receipt</button>
    </form>
  );
}
