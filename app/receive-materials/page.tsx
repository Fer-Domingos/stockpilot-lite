import { AppShell } from '@/app/components/app-shell';
import { receiveMaterial } from '@/app/actions';
import { jobLocations, materials } from '@/lib/demo-data';
import { getRole } from '@/lib/role';

export default function ReceiveMaterialsPage({ searchParams }: { searchParams: { role?: string } }) {
  const role = getRole(searchParams.role);

  return (
    <AppShell role={role}>
      <section className="card">
        <div className="section-title">
          <h3>Receive Materials</h3>
          <p className="muted">Select where inbound inventory should be posted.</p>
        </div>
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
          <select id="destinationType" name="destinationType" required>
            <option value="SHOP">Shop General Inventory</option>
            <option value="JOB">Job-Specific Inventory</option>
          </select>

          <label htmlFor="jobId">Destination Job (if Job selected)</label>
          <select id="jobId" name="jobId">
            <option value="">No job selected</option>
            {jobLocations.map((job) => (
              <option key={job.id} value={job.id}>
                {job.code} — {job.name}
              </option>
            ))}
          </select>

          <label htmlFor="quantity">Quantity Received</label>
          <input id="quantity" name="quantity" type="number" min="1" required />

          <label htmlFor="notes">Receiving Notes</label>
          <textarea id="notes" name="notes" rows={3} placeholder="PO, supplier, condition notes..." />
          <button type="submit">Post Receipt (Demo)</button>
        </form>
      </section>
    </AppShell>
  );
}
