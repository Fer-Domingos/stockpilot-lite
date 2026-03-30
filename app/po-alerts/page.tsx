import { AppShell } from '@/app/components/app-shell';
import { AlertsCenter } from '@/app/components/alerts-center';
import { PoTrackerManager } from '@/app/components/po-tracker-manager';
import { listExpectedPurchaseOrders, listJobs, listPurchaseOrderAlerts } from '@/app/actions';
import { ACTIVE_ALERT_STATUSES } from '@/lib/po-alerts';
import { getRole } from '@/lib/role';

const errorMessages: Record<string, string> = {
  'missing-po-number': 'PO number is required.',
  'invalid-job': 'Selected related job was not found.',
  'save-failed': 'Unable to save the tracked PO number right now.'
};

export default async function PurchaseOrderAlertsPage({
  searchParams
}: {
  searchParams: { role?: string; error?: string; message?: string; success?: string };
}) {
  const role = await getRole(searchParams.role);
  const [{ data: jobs }, { data: trackedPurchaseOrders }, { data: alerts }] = await Promise.all([
    listJobs(),
    listExpectedPurchaseOrders(role),
    listPurchaseOrderAlerts(25, role)
  ]);

  const openJobs = jobs.filter((job) => job.status === 'OPEN');
  const activeTrackedPurchaseOrders = trackedPurchaseOrders.filter((entry) =>
    ACTIVE_ALERT_STATUSES.includes(entry.status as (typeof ACTIVE_ALERT_STATUSES)[number])
  );
  const activeTrackedPurchaseOrderIds = new Set(activeTrackedPurchaseOrders.map((entry) => entry.id));
  const activeAlerts = alerts.filter((alert) => activeTrackedPurchaseOrderIds.has(alert.expectedPoId));
  const detailedMessage = searchParams.message ? decodeURIComponent(searchParams.message) : null;
  const errorMessage = detailedMessage || (searchParams.error ? errorMessages[searchParams.error] ?? 'Unable to save tracked PO.' : null);
  const showSuccess = searchParams.success === '1';

  return (
    <AppShell role={role}>
      {errorMessage ? <p style={{ color: '#b42318', marginBottom: '0.75rem' }}>{errorMessage}</p> : null}
      {showSuccess ? <p style={{ color: '#027a48', marginBottom: '0.75rem' }}>Tracked PO saved successfully.</p> : null}
      <PoTrackerManager jobs={openJobs} trackedPurchaseOrders={activeTrackedPurchaseOrders} role={role} />
      <AlertsCenter trackedPurchaseOrders={activeTrackedPurchaseOrders} triggeredAlerts={activeAlerts} role={role} compact showHeaderLink />
    </AppShell>
  );
}
