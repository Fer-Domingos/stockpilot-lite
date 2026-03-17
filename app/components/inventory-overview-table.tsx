import { InventoryBalanceView } from '@/app/actions';

export function InventoryOverviewTable({ rows }: { rows: InventoryBalanceView[] }) {
  return (
    <section className="card">
      <div className="section-title">
        <h3>Inventory Overview</h3>
        <p className="muted">Live quantities calculated from receive, transfer, and issue transactions.</p>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Material Name</th>
              <th>Unit</th>
              <th>Shop Quantity</th>
              <th>Total Job Quantity</th>
              <th>Total Quantity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const totalJobQuantity = row.jobQuantities.reduce((sum, entry) => sum + entry.quantity, 0);

              return (
                <tr key={row.materialId}>
                  <td>
                    <div>{row.materialName}</div>
                    <div className="muted">{row.materialSku}</div>
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
                  <td>{row.unit}</td>
                  <td>{row.shopQuantity}</td>
                  <td>{totalJobQuantity}</td>
                  <td>{row.totalQuantity}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
