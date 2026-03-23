import { AppRole } from '@/lib/demo-data';

export function canManageInventory(role: AppRole): boolean {
  return role === 'ADMIN';
}

export function canManageAlerts(role: AppRole): boolean {
  return role === 'ADMIN';
}
