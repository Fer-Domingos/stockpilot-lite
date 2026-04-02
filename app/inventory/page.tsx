import { listInventoryBalances } from '@/app/actions';
import { AppShell } from '@/app/components/app-shell';
import { InventoryOverviewTable } from '@/app/components/inventory-overview-table';
import { getRole } from '@/lib/role';

export const dynamic = 'force-dynamic';

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: { role?: string; lowStock?: string };
}) {
  const role = await getRole(searchParams.role);
  const { data: inventoryBalances } = await listInventoryBalances();
  const lowStockOnly = searchParams.lowStock === 'true';
  const rows = lowStockOnly
    ? inventoryBalances.filter((row) => row.minStock !== null && row.totalQuantity < row.minStock)
    : inventoryBalances;

  return (
    <AppShell role={role}>
      <InventoryOverviewTable rows={rows} lowStockOnly={lowStockOnly} />
    </AppShell>
  );
}
