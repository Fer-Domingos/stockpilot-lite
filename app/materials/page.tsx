import { AppShell } from '@/app/components/app-shell';
import { materials } from '@/lib/demo-data';
import { getRole } from '@/lib/role';

export default function MaterialsPage({ searchParams }: { searchParams: { role?: string } }) {
  const role = getRole(searchParams.role);

  return (
    <AppShell role={role}>
      <section className="card">
        <div className="section-title">
          <h3>Materials Master</h3>
          <p className="muted">Realistic demo inventory across Shop and active Jobs.</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Material</th>
              <th>Category</th>
              <th>Location</th>
              <th>On Hand</th>
              <th>Min</th>
              <th>Supplier</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((material) => (
              <tr key={material.id}>
                <td>{material.sku}</td>
                <td>{material.name}</td>
                <td>{material.category}</td>
                <td>{material.location}</td>
                <td>
                  {material.quantity} {material.unit}
                </td>
                <td>{material.minQuantity}</td>
                <td>{material.supplier}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
