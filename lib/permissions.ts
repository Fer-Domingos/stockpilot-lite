import { AppRole } from '@/lib/demo-data';

export function canManageInventory(role: AppRole): boolean {
  return role === 'ADMIN';
}

export function canReceiveMaterials(role: AppRole): boolean {
  return role === 'ADMIN' || role === 'PM';
}

export function canManageAlerts(role: AppRole): boolean {
  return role === 'ADMIN' || role === 'PM';
}
