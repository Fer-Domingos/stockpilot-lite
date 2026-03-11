import { AppShell } from '@/app/components/app-shell';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [materials, recentTransactions] = await Promise.all([
    prisma.material.findMany({ orderBy: { name: 'asc' } }),
    prisma.inventoryTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { material: true }
    })
  ]);

  const totalItems = materials.reduce((acc, material) => acc + material.quantity, 0);
  const lowStock = materials.filter((material) => material.quantity <= material.minQuantity).length;

  return (
    <AppShell>
      <h1>Dashboard</h1>
      <div className="grid">
        <div className="card">
          <h3>Total Materials</h3>
          <p>{materials.length}</p>
        </div>
        <div className="card">
          <h3>Total Units on Hand</h3>
          <p>{totalItems}</p>
        </div>
        <div className="card">
          <h3>Low Stock Alerts</h3>
          <p>{lowStock}</p>
        </div>
      </div>
      <div className="card">
        <h3>Recent Activity</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Material</th>
              <th>Type</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            {recentTransactions.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.createdAt.toLocaleDateString()}</td>
                <td>{entry.material.name}</td>
                <td>{entry.type}</td>
                <td>{entry.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
