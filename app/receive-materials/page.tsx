import { AppShell } from '@/app/components/app-shell';
import { ReceiveMaterialForm } from '@/app/components/receive-material-form';
import { listJobs, listMaterials, listReceivingRecords } from '@/app/actions';
import { getRole } from '@/lib/role';

const errorMessages: Record<string, string> = {
  'missing-required-fields': 'Material, quantity, and destination are required.',
  'job-required-for-job-destination': 'Please select a destination job when destination is Job.',
  'save-failed': 'Unable to save receipt right now. Please try again.'
};

export default async function ReceiveMaterialsPage({
  searchParams
}: {
  searchParams: { role?: string; error?: string; success?: string };
}) {
  const role = getRole(searchParams.role);
  const [{ data: materials }, { data: jobs }, { data: receipts }] = await Promise.all([
    listMaterials(),
    listJobs(),
    listReceivingRecords()
  ]);
  const openJobs = jobs.filter((job) => job.status === 'OPEN');
  const errorMessage = searchParams.error ? errorMessages[searchParams.error] ?? 'Unable to receive material.' : null;
  const showSuccess = searchParams.success === '1';

  return (
    <AppShell role={role}>
      <section className="card">
        <div className="section-title">
          <h3>Receive Materials</h3>
          <p className="muted">Capture vendor receipts with invoice, destination, and optional photo reference.</p>
        </div>
        {errorMessage ? <p style={{ color: '#b42318', marginBottom: '0.75rem' }}>{errorMessage}</p> : null}
        {showSuccess ? <p style={{ color: '#027a48', marginBottom: '0.75rem' }}>Receipt posted successfully.</p> : null}
        <ReceiveMaterialForm materials={materials} jobs={openJobs} />
      </section>

      <section className="card">
        <div className="section-title">
          <h3>Recent Receipts</h3>
          <p className="muted">Latest database-backed receive transactions.</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Received</th>
              <th>Invoice #</th>
              <th>SKU</th>
              <th>Material</th>
              <th>Qty</th>
              <th>Destination</th>
              <th>Vendor</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((receipt) => (
              <tr key={receipt.id}>
                <td>{new Date(receipt.receivedAt).toLocaleString()}</td>
                <td>{receipt.invoiceNumber}</td>
                <td>{receipt.materialSku}</td>
                <td>{receipt.materialName}</td>
                <td>{receipt.quantity}</td>
                <td>{receipt.destinationLabel}</td>
                <td>{receipt.vendorName}</td>
                <td>{receipt.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
