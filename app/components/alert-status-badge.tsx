import { AlertStatus } from '@/app/actions';

const statusLabels: Record<AlertStatus, string> = {
  OPEN: 'Open',
  TRIGGERED: 'Triggered',
  SEEN: 'Seen',
  RESOLVED: 'Resolved'
};

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  return <span className={`alert-badge alert-badge-${status.toLowerCase()}`}>{statusLabels[status]}</span>;
}
