import { AppShell } from '@/app/components/app-shell';
import { receiveMaterial } from '@/app/actions';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function ReceiveMaterialsPage() {
  const materials = await prisma.material.findMany({ orderBy: { name: 'asc' } });

  return (
    <AppShell>
      <h1>Receive Materials</h1>
      <div className="card">
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
          <label htmlFor="quantity">Quantity received</label>
          <input id="quantity" name="quantity" type="number" min="1" required />
          <label htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" rows={3} placeholder="Optional" />
          <button type="submit">Receive</button>
        </form>
      </div>
    </AppShell>
  );
}
