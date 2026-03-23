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

  const activeAlerts = trackedPurchaseOrders.filter((alert) => alert.status === 'OPEN' || alert.status === 'TRIGGERED');
  const seenAlerts = trackedPurchaseOrders.filter((alert) => alert.status === 'SEEN');
  const resolvedAlerts = trackedPurchaseOrders.filter((alert) => alert.status === 'RESOLVED');
  const activeAlertIds = new Set(activeAlerts.map((alert) => alert.id));
  const activeTriggeredAlerts = triggeredAlerts.filter((alert) => activeAlertIds.has(alert.expectedPoId));

  return (
    <AppShell role={role}>
      {errorMessage ? <p style={{ color: '#b42318', marginBottom: '0.75rem' }}>{errorMessage}</p> : null}
      {successMessage ? <p style={{ color: '#027a48', marginBottom: '0.75rem' }}>{successMessage}</p> : null}

      <section className="kpi-grid">
        <article className="card kpi-card">
          <p className="muted">Active Alerts</p>
          <h3>{activeAlerts.length}</h3>
        </article>
        <article className="card kpi-card">
          <p className="muted">Seen Alerts</p>
          <h3>{seenAlerts.length}</h3>
        </article>
        <article className="card kpi-card">
          <p className="muted">Resolved Alerts</p>
          <h3>{resolvedAlerts.length}</h3>
        </article>
      </section>

      <AlertsCenter
        trackedPurchaseOrders={activeAlerts}
        triggeredAlerts={activeTriggeredAlerts}
        role={role}
        title="Active Alerts"
        description="Tracked POs that are still open or have been triggered by a matching receipt."
        emptyMessage="No open or triggered alerts right now."
      />

      <AlertsCenter
        trackedPurchaseOrders={seenAlerts}
        triggeredAlerts={[]}
        role={role}
        title="Seen Alerts"
        description="Alerts already reviewed by a PM but not yet resolved."
        emptyMessage="No seen alerts to review."
        showTriggeredNotifications={false}
      />

      <AlertsCenter
        trackedPurchaseOrders={resolvedAlerts}
        triggeredAlerts={[]}
        role={role}
        title="Resolved Alerts"
        description="Closed alerts retained for audit history and traceability."
        emptyMessage="No resolved alerts yet."
        showTriggeredNotifications={false}
      />
    </AppShell>
  );
}
