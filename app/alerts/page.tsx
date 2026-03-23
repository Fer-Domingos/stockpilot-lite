import { AlertsCenter } from '@/app/components/alerts-center';
import { AppShell } from '@/app/components/app-shell';
import { listExpectedPurchaseOrders, listPurchaseOrderAlerts } from '@/app/actions';
import { getRole } from '@/lib/role';

const successMessages: Record<string, string> = {
  seen: 'Alert marked as seen.',
  resolved: 'Alert marked as resolved.'
};

const errorMessages: Record<string, string> = {
  'invalid-alert': 'The selected PO alert was not found.'
};

export default async function AlertsPage({
  searchParams
}: {
  searchParams: { role?: string; error?: string; success?: string };
}) {
  const role = getRole(searchParams.role);
  const [{ data: trackedPurchaseOrders }, { data: triggeredAlerts }] = await Promise.all([
    listExpectedPurchaseOrders(),
    listPurchaseOrderAlerts(50)
  ]);

  const successMessage = searchParams.success ? successMessages[searchParams.success] ?? null : null;
  const errorMessage = searchParams.error ? errorMessages[searchParams.error] ?? 'Unable to update alert.' : null;

  return (
    <AppShell role={role}>
      {errorMessage ? <p style={{ color: '#b42318', marginBottom: '0.75rem' }}>{errorMessage}</p> : null}
      {successMessage ? <p style={{ color: '#027a48', marginBottom: '0.75rem' }}>{successMessage}</p> : null}
      <AlertsCenter trackedPurchaseOrders={trackedPurchaseOrders} triggeredAlerts={triggeredAlerts} role={role} />
    </AppShell>
  );
}
