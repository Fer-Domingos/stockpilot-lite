import { AppShell } from '@/app/components/app-shell';
import { LocalDateTime } from '@/app/components/local-date-time';
import { getRole } from '@/lib/role';
import { unstable_noStore as noStore } from 'next/cache';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

type HistoryRow = {
  id: string;
  createdAt: string;
  type?: string;
  transactionType?: string;
  materialName: string;
  quantity: number;
  unit: string;
  locationFrom?: string | null;
  locationTo?: string | null;
  invoiceNumber?: string | null;
  vendorName?: string | null;
  vendor?: string | null;
  notes?: string | null;
};

export default async function HistoryPage({ searchParams }: { searchParams: { role?: string } }) {
  noStore();
  const role = await getRole(searchParams.role);

  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http';
  const origin = host ? `${protocol}://${host}` : '';

  let rawTransactions: HistoryRow[] = [];

  try {
    const response = await fetch(`${origin}/api/history`, { cache: 'no-store' });

    if (response.ok) {
      const historyResponse = (await response.json()) as { data?: HistoryRow[]; transactions?: HistoryRow[] };
      rawTransactions = historyResponse.data ?? historyResponse.transactions ?? [];
    }
  } catch (error) {
    console.error('Failed to load history rows from /api/history:', error);
  }

  const transactions = rawTransactions.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    type: row.type ?? row.transactionType ?? '—',
    materialName: row.materialName,
    locationFrom: row.locationFrom ?? '—',
    locationTo: row.locationTo ?? '—',
    quantity: row.quantity,
    unit: row.unit,
    invoiceNumber: row.invoiceNumber ?? '—',
    vendorName: row.vendorName ?? row.vendor ?? '—',
    notes: row.notes ?? '—'
  }));

  return (
    <AppShell role={role}>
      <section className="card">
        <div className="section-title">
          <h3>Transaction History</h3>
          <p className="muted">Ledger entries for RECEIVE, TRANSFER, ISSUE, and ADJUSTMENT.</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Material</th>
              <th>From</th>
              <th>To</th>
              <th>Qty</th>
              <th>Invoice #</th>
              <th>Vendor</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={9} className="muted" style={{ textAlign: 'center' }}>
                  No transactions found yet.
                </td>
              </tr>
            ) : (
              transactions.map((entry) => (
                <tr key={entry.id}>
                  <td><LocalDateTime value={entry.createdAt} /></td>
                  <td>{entry.type}</td>
                  <td>{entry.materialName}</td>
                  <td>{entry.locationFrom}</td>
                  <td>{entry.locationTo}</td>
                  <td>
                    {entry.quantity} {entry.unit}
                  </td>
                  <td>{entry.invoiceNumber}</td>
                  <td>{entry.vendorName}</td>
                  <td>{entry.notes}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
