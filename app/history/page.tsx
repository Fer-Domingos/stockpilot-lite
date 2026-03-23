import { AppShell } from '@/app/components/app-shell';
import { LocalDateTime } from '@/app/components/local-date-time';
import { reverseInventoryTransaction } from '@/app/actions';
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
  reversedTransactionId?: string | null;
  reversalReason?: string | null;
  reversedAt?: string | null;
  reversedByEmail?: string | null;
  isReversal?: boolean;
  isReversed?: boolean;
};

export default async function HistoryPage({ searchParams }: { searchParams: { role?: string; error?: string; message?: string; success?: string } }) {
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
    notes: row.notes ?? '—',
    reversedTransactionId: row.reversedTransactionId ?? null,
    reversalReason: row.reversalReason ?? null,
    reversedAt: row.reversedAt ?? null,
    reversedByEmail: row.reversedByEmail ?? null,
    isReversal: Boolean(row.isReversal),
    isReversed: Boolean(row.isReversed)
  }));

  const successMessage = searchParams.success === 'reversed' ? 'Transaction reversed successfully with an audit-safe reversal entry.' : null;
  const errorMessage = searchParams.error === 'reverse-failed' ? searchParams.message ?? 'Unable to reverse the selected transaction.' : null;

  return (
    <AppShell role={role}>
      <section className="card">
        <div className="section-title">
          <div>
            <h3>Transaction History</h3>
            <p className="muted">Ledger entries for RECEIVE, TRANSFER, ISSUE, and ADJUSTMENT.</p>
          </div>
          <div className="muted" style={{ textAlign: 'right' }}>
            <div>Only Admin can reverse eligible transactions.</div>
            <div>Original transactions are never deleted.</div>
          </div>
        </div>
        {successMessage ? (
          <p style={{ color: '#166534', marginBottom: '1rem' }}>{successMessage}</p>
        ) : null}
        {errorMessage ? (
          <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{errorMessage}</p>
        ) : null}
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Material</th>
              <th>Status</th>
              <th>From</th>
              <th>To</th>
              <th>Qty</th>
              <th>Invoice #</th>
              <th>Vendor</th>
              <th>Notes</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={11} className="muted" style={{ textAlign: 'center' }}>
                  No transactions found yet.
                </td>
              </tr>
            ) : (
              transactions.map((entry) => {
                const statusLabel = entry.isReversal
                  ? `Reversal${entry.reversedTransactionId ? ` of ${entry.reversedTransactionId}` : ''}`
                  : entry.isReversed
                    ? 'Reversed'
                    : 'Active';
                const canReverse = role === 'ADMIN' && !entry.isReversal && !entry.isReversed && ['RECEIVE', 'TRANSFER', 'ISSUE'].includes(entry.type);

                return (
                  <tr key={entry.id}>
                    <td><LocalDateTime value={entry.createdAt} /></td>
                    <td>{entry.type}</td>
                    <td>{entry.materialName}</td>
                    <td>
                      <div>{statusLabel}</div>
                      {entry.reversalReason ? <div className="muted">Reason: {entry.reversalReason}</div> : null}
                      {entry.reversedByEmail ? <div className="muted">By: {entry.reversedByEmail}</div> : null}
                      {entry.reversedAt ? <div className="muted">At: <LocalDateTime value={entry.reversedAt} /></div> : null}
                    </td>
                    <td>{entry.locationFrom}</td>
                    <td>{entry.locationTo}</td>
                    <td>
                      {entry.quantity} {entry.unit}
                    </td>
                    <td>{entry.invoiceNumber}</td>
                    <td>{entry.vendorName}</td>
                    <td>{entry.notes}</td>
                    <td>
                      {canReverse ? (
                        <details>
                          <summary style={{ cursor: 'pointer', color: '#0f172a', fontWeight: 600 }}>Reverse</summary>
                          <form action={reverseInventoryTransaction} style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem', minWidth: '16rem' }}>
                            <input type="hidden" name="transactionId" value={entry.id} />
                            <label style={{ display: 'grid', gap: '0.35rem' }}>
                              <span className="muted">Reversal reason</span>
                              <textarea
                                name="reversalReason"
                                rows={3}
                                minLength={10}
                                required
                                placeholder="Explain why this transaction is being reversed."
                              />
                            </label>
                            <div className="muted" style={{ fontSize: '0.85rem' }}>
                              Minimum 10 characters. Original transaction stays in history and a separate reversal entry will be created.
                            </div>
                            <button type="submit">Confirm reversal</button>
                          </form>
                        </details>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
