import { AppShell } from '@/app/components/app-shell';
import { transferMaterial } from '@/app/actions';
import { jobLocations, materials } from '@/lib/demo-data';
import { getRole } from '@/lib/role';

export default function TransferMaterialsPage({ searchParams }: { searchParams: { role?: string } }) {
  const role = getRole(searchParams.role);

  return (
    <AppShell role={role}>
      <section className="card">
        <div className="section-title">
          <h3>Transfer Materials</h3>
          <p className="muted">Move stock between Shop and job inventories.</p>
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
            <option value="SHOP">Shop General Inventory</option>
            {jobLocations.map((job) => (
              <option key={job.id} value={job.id}>
                {job.code} — {job.name}
              </option>
            ))}
          </select>

          <label htmlFor="toLocation">To</label>
          <select id="toLocation" name="toLocation" required>
            <option value="SHOP">Shop General Inventory</option>
            {jobLocations.map((job) => (
              <option key={job.id} value={job.id}>
                {job.code} — {job.name}
              </option>
            ))}
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
