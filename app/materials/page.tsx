import { AppShell } from '@/app/components/app-shell';
import { createMaterial } from '@/app/actions';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function MaterialsPage() {
  const materials = await prisma.material.findMany({ orderBy: { name: 'asc' } });

  return (
    <AppShell>
      <h1>Materials</h1>
      <div className="card">
        <h3>Add Material</h3>
        <form action={createMaterial}>
          <input name="sku" placeholder="SKU" required />
          <input name="name" placeholder="Material name" required />
          <input name="unit" placeholder="Unit (sheet, roll...)" required />
          <input name="minQuantity" type="number" min="0" placeholder="Min quantity" required />
          <button type="submit">Add Material</button>
        </form>
      </div>

      <div className="card">
        <h3>Current Inventory</h3>
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Name</th>
              <th>Unit</th>
              <th>On Hand</th>
              <th>Min</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((material) => (
              <tr key={material.id}>
                <td>{material.sku}</td>
                <td>{material.name}</td>
                <td>{material.unit}</td>
                <td>{material.quantity}</td>
                <td>{material.minQuantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
