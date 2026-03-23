import { AppShell } from '@/app/components/app-shell';
import { InventoryBalanceTable } from '@/app/components/inventory-balance-table';
import { MaterialsManager } from '@/app/components/materials-manager';
import { listInventoryBalances, listMaterials } from '@/app/actions';
import { getRole } from '@/lib/role';

export const dynamic = 'force-dynamic';

export default async function MaterialsPage({ searchParams }: { searchParams: { role?: string } }) {
  const role = await getRole(searchParams.role);
  const [{ data: materials }, { data: inventoryBalances }] = await Promise.all([listMaterials(), listInventoryBalances()]);

  return (
    <AppShell role={role}>
      <MaterialsManager initialMaterials={materials} role={role} />
      <InventoryBalanceTable rows={inventoryBalances} />
    </AppShell>
  );
}
