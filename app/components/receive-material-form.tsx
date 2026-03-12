'use client';

import { useMemo, useState } from 'react';

import { JobRecord, MaterialRecord, receiveMaterial } from '@/app/actions';

export function ReceiveMaterialForm({ materials, jobs }: { materials: MaterialRecord[]; jobs: JobRecord[] }) {
  const [destinationType, setDestinationType] = useState<'SHOP' | 'JOB'>('SHOP');
  const isJobDestination = destinationType === 'JOB';

  const destinationHint = useMemo(() => {
    if (isJobDestination) {
      return 'Post directly into an open job inventory allocation.';
    }

    return 'Post into Shop general inventory.';
  }, [isJobDestination]);

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

      <label htmlFor="destinationType">Destination</label>
      <select
        id="destinationType"
        name="destinationType"
        value={destinationType}
        onChange={(event) => setDestinationType(event.target.value as 'SHOP' | 'JOB')}
        required
      >
        <option value="SHOP">Shop</option>
        <option value="JOB">Job</option>
      </select>

      <p className="muted">{destinationHint}</p>

      {isJobDestination && (
        <>
          <label htmlFor="jobId">Destination Job (Open Only)</label>
          <select id="jobId" name="jobId" required>
            <option value="">Select open job</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.number} — {job.name}
              </option>
            ))}
          </select>
        </>
      )}

      {!isJobDestination && <input type="hidden" name="jobId" value="" />}

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
