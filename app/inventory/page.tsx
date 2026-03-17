import { listInventoryBalances } from '@/app/actions';
import { AppShell } from '@/app/components/app-shell';
import { InventoryOverviewTable } from '@/app/components/inventory-overview-table';
import { getRole } from '@/lib/role';

export const dynamic = 'force-dynamic';

export default async function InventoryPage({ searchParams }: { searchParams: { role?: string } }) {
  const role = getRole(searchParams.role);
  const { data: inventoryBalances } = await listInventoryBalances();

  return (
    <AppShell role={role}>
      <InventoryOverviewTable rows={inventoryBalances} />
    </AppShell>
  );
}
