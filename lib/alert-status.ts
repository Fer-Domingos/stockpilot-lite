export type AlertStatusValue = "OPEN" | "TRIGGERED" | "SEEN" | "RESOLVED";

export const ACTIVE_ALERT_STATUSES: AlertStatusValue[] = ["OPEN", "TRIGGERED"];

export function isActiveAlertStatus(status: AlertStatusValue): boolean {
  return ACTIVE_ALERT_STATUSES.includes(status);
}
