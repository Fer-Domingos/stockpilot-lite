import { AlertStatus } from '@/app/actions';

export function isActiveAlertStatus(status: AlertStatus): boolean {
  return status === 'OPEN' || status === 'TRIGGERED';
}
