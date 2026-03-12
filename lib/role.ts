import { AppRole } from '@/lib/demo-data';

export function getRole(roleValue?: string): AppRole {
  return roleValue === 'Engineer / PM' ? 'Engineer / PM' : 'Admin';
}
