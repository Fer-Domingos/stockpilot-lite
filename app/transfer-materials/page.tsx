import { AppShell } from '@/app/components/app-shell';
import { transferMaterial } from '@/app/actions';
import { jobs, materials } from '@/lib/demo-data';
import { getRole } from '@/lib/role';

export default function TransferMaterialsPage({ searchParams }: { searchParams: { role?: string } }) {
  const role = getRole(searchParams.role);

  return (
    <AppShell role={role}>
      <section className="card">
        <div className="section-title">
          <h3>Transfer Materials</h3>
          <p className="muted">Supported: Shop → Job, Job → Shop, and Job → Job transfers.</p>
        </div>
        <form action={transferMaterial}>
          <label htmlFor="materialId">Material</label>
          <select id="materialId" name="materialId" required>
            <option value="">Select material</option>
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.name} ({material.sku})
              </option>
            ))}
          </select>

          <label htmlFor="fromLocation">From</label>
          <select id="fromLocation" name="fromLocation" required>
            <optgroup label="Shop">
              <option value="shop">Shop</option>
            </optgroup>
            <optgroup label="Jobs">
              {jobs.map((job) => (
                <option key={job.id} value={`loc-${job.id}`}>
                  {job.number} — {job.name}
                </option>
              ))}
            </optgroup>
          </select>

          <label htmlFor="toLocation">To</label>
          <select id="toLocation" name="toLocation" required>
            <optgroup label="Shop">
              <option value="shop">Shop</option>
            </optgroup>
            <optgroup label="Jobs">
              {jobs.map((job) => (
                <option key={job.id} value={`loc-${job.id}`}>
                  {job.number} — {job.name}
                </option>
              ))}
            </optgroup>
          </select>

          <label htmlFor="quantity">Transfer Quantity</label>
          <input id="quantity" name="quantity" type="number" min="1" required />

          <label htmlFor="notes">Transfer Notes</label>
          <textarea id="notes" name="notes" rows={3} placeholder="Cart number, phase, priority..." />
          <button type="submit">Submit Transfer (Demo)</button>
        </form>
      </section>
    </AppShell>
  );
}
