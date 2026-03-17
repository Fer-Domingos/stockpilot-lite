import { InventoryBalanceView } from '@/app/actions';

export function InventoryBalanceTable({ rows }: { rows: InventoryBalanceView[] }) {
  return (
    <section className="card">
      <div className="section-title">
        <h3>Inventory Balances</h3>
        <p className="muted">Live stock by Shop and Job location.</p>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Material</th>
              <th>Total Qty</th>
              <th>Shop Qty</th>
              <th>Job Quantities</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.materialId}>
                <td>{row.materialSku}</td>
                <td>{row.materialName}</td>
                <td>
                  {row.totalQuantity} {row.unit}
                </td>
                <td>
                  {row.shopQuantity} {row.unit}
                </td>
                <td>
                  {row.jobQuantities.length === 0
                    ? '—'
                    : row.jobQuantities.map((entry) => `${entry.jobLabel}: ${entry.quantity}`).join(' • ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
