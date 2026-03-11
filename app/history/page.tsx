import { AppShell } from '@/app/components/app-shell';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const history = await prisma.inventoryTransaction.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      material: true,
      user: true,
      location: true
    }
  });

  return (
    <AppShell>
      <h1>History</h1>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Material</th>
              <th>Quantity</th>
              <th>Location</th>
              <th>User</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {history.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.createdAt.toLocaleString()}</td>
                <td>{entry.type}</td>
                <td>{entry.material.name}</td>
                <td>{entry.quantity}</td>
                <td>{entry.location.name}</td>
                <td>{entry.user.name}</td>
                <td>{entry.notes ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
