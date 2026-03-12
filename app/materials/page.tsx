import { AppShell } from '@/app/components/app-shell';
import { getLocationName, getMaterialTotalQuantity, inventoryLocations, materials } from '@/lib/demo-data';
import { getRole } from '@/lib/role';

export default function MaterialsPage({ searchParams }: { searchParams: { role?: string } }) {
  const role = getRole(searchParams.role);

  return (
    <AppShell role={role}>
      <section className="card">
        <div className="section-title">
          <h3>Materials Master</h3>
          <p className="muted">Inventory quantities are split by Shop and Job locations.</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Material</th>
              <th>Category</th>
              {inventoryLocations.map((location) => (
                <th key={location.id}>{location.name}</th>
              ))}
              <th>Total On Hand</th>
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
                {inventoryLocations.map((location) => {
                  const locationEntry = material.inventory.find((entry) => entry.locationId === location.id);

                  return (
                    <td key={`${material.id}-${location.id}`} title={getLocationName(location.id)}>
                      {locationEntry?.quantity ?? 0}
                    </td>
                  );
                })}
                <td>
                  {getMaterialTotalQuantity(material)} {material.unit}
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
