import { PurchaseOrderAlertStatus } from '@prisma/client';

export const ACTIVE_ALERT_STATUSES: ReadonlyArray<PurchaseOrderAlertStatus> = ['OPEN', 'TRIGGERED'];

export function isActiveAlertStatus(status: PurchaseOrderAlertStatus) {
  return ACTIVE_ALERT_STATUSES.includes(status);
}
