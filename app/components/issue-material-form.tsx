'use client';

import { JobRecord, MaterialRecord, issueMaterial } from '@/app/actions';
import { issueUsedForOptions } from '@/lib/issue-usage';

export function IssueMaterialForm({ materials, jobs }: { materials: MaterialRecord[]; jobs: JobRecord[] }) {
  return (
    <form action={issueMaterial}>
      <label htmlFor="materialId">Material</label>
      <select id="materialId" name="materialId" required>
        <option value="">Select material</option>
        {materials.map((material) => (
          <option key={material.id} value={material.id}>
            {material.name} ({material.sku})
          </option>
        ))}
      </select>

      <label htmlFor="fromLocation">Issue From</label>
      <select id="fromLocation" name="fromLocation" required>
        <optgroup label="Shop">
          <option value="shop">Shop</option>
        </optgroup>
        <optgroup label="Open Jobs">
          {jobs.map((job) => (
            <option key={job.id} value={`loc-${job.id}`}>
              {job.number} — {job.name}
            </option>
          ))}
        </optgroup>
      </select>

      <label htmlFor="quantity">Issue Quantity</label>
      <input id="quantity" name="quantity" type="number" min="1" required />

      <label htmlFor="usedFor">Used For</label>
      <select id="usedFor" name="usedFor" required>
        <option value="">Select usage type</option>
        {issueUsedForOptions.map((usedFor) => (
          <option key={usedFor} value={usedFor}>
            {usedFor}
          </option>
        ))}
      </select>

      <label htmlFor="issueTo">Issue To</label>
      <select id="issueTo" name="issueTo" defaultValue="production">
        <option value="production">Production / Consumption</option>
        <option value="job">Specific Job</option>
      </select>

      <label htmlFor="issueToJobId">Issue To Job (Optional)</label>
      <select id="issueToJobId" name="issueToJobId" defaultValue="">
        <option value="">Select job</option>
        {jobs.map((job) => (
          <option key={job.id} value={job.id}>
            {job.number} — {job.name}
          </option>
        ))}
      </select>

      <label htmlFor="notes">Issue Notes</label>
      <textarea id="notes" name="notes" rows={3} placeholder="Work order, station, phase..." />

      <button type="submit">Post Issue</button>
    </form>
  );
}
