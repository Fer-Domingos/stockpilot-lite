import { InventoryBalanceView } from '@/app/actions';

export function InventoryOverviewTable({
  rows,
  lowStockOnly = false,
}: {
  rows: InventoryBalanceView[];
  lowStockOnly?: boolean;
}) {
  return (
    <section className="card">
      <div className="section-title">
        <div>
          <h3>{lowStockOnly ? 'Low Stock Inventory' : 'Inventory Overview'}</h3>
          <p className="muted">
            {lowStockOnly
              ? 'Showing only materials whose current stock is below their minimum level.'
              : 'Live quantities calculated from receive, transfer, and issue transactions.'}
          </p>
        </div>
        {lowStockOnly ? <p className="muted">{rows.length} item(s) below minimum</p> : null}
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Material Name</th>
              <th>SKU</th>
              <th>Unit</th>
              <th>Shop Quantity</th>
              <th>Total Job Quantity</th>
              <th>Current Stock</th>
              <th>Minimum Stock</th>
              <th>Shortage</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">
                  {lowStockOnly
                    ? 'No materials are currently below minimum stock.'
                    : 'No inventory balances are available yet.'}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const totalJobQuantity = row.jobQuantities.reduce((sum, entry) => sum + entry.quantity, 0);
                const shortage = row.minStock === null ? 0 : Math.max(row.minStock - row.totalQuantity, 0);

                return (
                  <tr key={row.materialId}>
                    <td>
                      <div>{row.materialName}</div>
                      <details className="job-breakdown">
                        <summary>Job breakdown ({row.jobQuantities.length})</summary>
                        {row.jobQuantities.length === 0 ? (
                          <p className="muted">No job allocations.</p>
                        ) : (
                          <table className="nested-table">
                            <thead>
                              <tr>
                                <th>Job Name</th>
                                <th>Quantity</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.jobQuantities.map((entry) => (
                                <tr key={entry.jobId}>
                                  <td>{entry.jobLabel}</td>
                                  <td>
                                    {entry.quantity} {row.unit}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </details>
                    </td>
                    <td>{row.materialSku}</td>
                    <td>{row.unit}</td>
                    <td>{row.shopQuantity}</td>
                    <td>{totalJobQuantity}</td>
                    <td>{row.totalQuantity}</td>
                    <td>{row.minStock ?? '—'}</td>
                    <td>{shortage > 0 ? shortage : '—'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
