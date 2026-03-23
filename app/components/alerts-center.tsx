import Link from 'next/link';

import {
  ExpectedPurchaseOrderRecord,
  markPurchaseOrderAlertResolved,
  markPurchaseOrderAlertSeen,
  PurchaseOrderAlertRecord
} from '@/app/actions';
import { AlertStatusBadge } from '@/app/components/alert-status-badge';
import { LocalDateTime } from '@/app/components/local-date-time';
import { AppRole } from '@/lib/demo-data';
import { canManageAlerts } from '@/lib/permissions';

export function AlertsCenter({
  trackedPurchaseOrders,
  triggeredAlerts,
  role,
  compact = false,
  showHeaderLink = false,
  title,
  description,
  emptyMessage,
  showTriggeredNotifications = true
}: {
  trackedPurchaseOrders: ExpectedPurchaseOrderRecord[];
  triggeredAlerts: PurchaseOrderAlertRecord[];
  role: AppRole;
  compact?: boolean;
  showHeaderLink?: boolean;
  title?: string;
  description?: string;
  emptyMessage?: string;
  showTriggeredNotifications?: boolean;
}) {
  const activeAlerts = trackedPurchaseOrders.filter((alert) => alert.status !== 'RESOLVED');
  const canUpdateAlerts = canManageAlerts(role);
  const rows = compact ? activeAlerts.slice(0, 6) : trackedPurchaseOrders;
  const heading = title ?? (compact ? 'Alerts Requiring Attention' : 'Alerts / Notifications');
  const subheading =
    description ??
    'Track PO alerts through Open, Triggered, Seen, and Resolved states with normalized PO matching.';

  return (
    <section className="card">
      <div className="section-title">
        <div>
          <h3>{heading}</h3>
          <p className="muted">{subheading}</p>
        </div>
        {showHeaderLink ? (
          <Link className="ghost-button" href={{ pathname: '/alerts', query: { role } }}>
            Open Alerts Page
          </Link>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="muted">{emptyMessage ?? 'No PO alerts to review.'}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>PO</th>
              <th>Related Job</th>
              <th>Last Trigger</th>
              <th>Latest Notification</th>
              <th>Material</th>
              <th>Invoice / PO</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((alert) => {
              const canMarkSeen = canUpdateAlerts && alert.status === 'TRIGGERED';
              const canResolve = canUpdateAlerts && (alert.status === 'TRIGGERED' || alert.status === 'SEEN');
              const lastUpdated = alert.lastTriggeredAt ?? alert.createdAt;

              return (
                <tr key={alert.id}>
                  <td>
                    <AlertStatusBadge status={alert.status} />
                    <div className="muted">Triggered {alert.triggerCount} time(s)</div>
                    <div className="muted">Owner: {alert.ownerEmail}</div>
                  </td>
                  <td>
                    {alert.poNumber}
                    <div className="muted">Normalized: {alert.normalizedPoNumber}</div>
                  </td>
                  <td>{alert.jobLabel}</td>
                  <td><LocalDateTime value={lastUpdated} /></td>
                  <td>
                    {alert.latestAlertMessage || 'Awaiting matching receipt.'}
                    <div className="muted">
                      Seen: <LocalDateTime value={alert.seenAt} /> · Resolved: <LocalDateTime value={alert.resolvedAt} />
                    </div>
                  </td>
                  <td>
                    {alert.latestAlertMaterialName}
                    <div className="muted">{alert.latestAlertMaterialSku}</div>
                  </td>
                  <td>{alert.latestAlertInvoiceNumber}</td>
                  <td>
                    <div className="row-actions">
                      {canMarkSeen ? (
                        <form className="inline-form" action={markPurchaseOrderAlertSeen}>
                          <input type="hidden" name="expectedPoId" value={alert.id} />
                          <input type="hidden" name="role" value={role} />
                          <button className="secondary-button" type="submit">
                            Mark as Seen
                          </button>
                        </form>
                      ) : null}
                      {canResolve ? (
                        <form className="inline-form" action={markPurchaseOrderAlertResolved}>
                          <input type="hidden" name="expectedPoId" value={alert.id} />
                          <input type="hidden" name="role" value={role} />
                          <button className="danger-button" type="submit">
                            Resolve
                          </button>
                        </form>
                      ) : null}
                      {!canMarkSeen && !canResolve ? <span className="muted">No action</span> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {!compact && showTriggeredNotifications && (
        <>
          <div className="section-title" style={{ marginTop: '1rem' }}>
            <div>
              <h3>Triggered Notifications</h3>
              <p className="muted">Latest triggered notification records linked to tracked PO alerts.</p>
            </div>
          </div>
          {triggeredAlerts.length === 0 ? (
            <p className="muted">No triggered notifications yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>PO</th>
                  <th>Material</th>
                  <th>Invoice / PO</th>
                  <th>Related Job</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {triggeredAlerts.map((alert) => (
                  <tr key={alert.id}>
                    <td>
                      <AlertStatusBadge status={alert.status} />
                      <div className="muted">Triggered {alert.triggerCount} time(s)</div>
                      <div className="muted">Owner: {alert.ownerEmail}</div>
                    </td>
                    <td><LocalDateTime value={alert.updatedAt} /></td>
                    <td>{alert.poNumber}</td>
                    <td>
                      {alert.materialName}
                      <div className="muted">{alert.materialSku}</div>
                    </td>
                    <td>{alert.invoiceNumber}</td>
                    <td>{alert.relatedJobLabel}</td>
                    <td>{alert.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}
