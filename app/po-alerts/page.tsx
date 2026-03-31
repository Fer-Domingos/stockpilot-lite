import { AppShell } from '@/app/components/app-shell';
import { PoTrackerManager } from '@/app/components/po-tracker-manager';
import { listExpectedPurchaseOrders, listJobs } from '@/app/actions';
import { getRole } from '@/lib/role';

const errorMessages: Record<string, string> = {
  'missing-po-number': 'PO number is required.',
  'invalid-job': 'Selected related job was not found.',
  'save-failed': 'Unable to save the tracked PO number right now.',
  'invalid-alert': 'The selected PO alert was not found.'
};

const successMessages: Record<string, string> = {
  '1': 'Tracked PO saved successfully.',
  seen: 'Alert marked as seen.',
  resolved: 'Alert marked as resolved.'
};

export default async function PurchaseOrderAlertsPage({
  searchParams
}: {
  searchParams: { role?: string; error?: string; message?: string; success?: string };
}) {
  const role = await getRole(searchParams.role);
  const [{ data: jobs }, { data: trackedPurchaseOrders }] = await Promise.all([listJobs(), listExpectedPurchaseOrders(role)]);

  const openJobs = jobs.filter((job) => job.status === 'OPEN');
  const detailedMessage = searchParams.message ? decodeURIComponent(searchParams.message) : null;
  const errorMessage = detailedMessage || (searchParams.error ? errorMessages[searchParams.error] ?? 'Unable to save tracked PO.' : null);
  const successMessage = searchParams.success ? successMessages[searchParams.success] ?? null : null;

  return (
    <AppShell role={role}>
      {errorMessage ? <p style={{ color: '#b42318', marginBottom: '0.75rem' }}>{errorMessage}</p> : null}
      {successMessage ? <p style={{ color: '#027a48', marginBottom: '0.75rem' }}>{successMessage}</p> : null}
      <PoTrackerManager jobs={openJobs} trackedPurchaseOrders={trackedPurchaseOrders} role={role} />
    </AppShell>
  );
}
