import { AppShell } from '@/app/components/app-shell';
import { MaterialsManager } from '@/app/components/materials-manager';
import { listMaterials } from '@/app/actions';
import { getRole } from '@/lib/role';

export default async function MaterialsPage({ searchParams }: { searchParams: { role?: string } }) {
  const role = getRole(searchParams.role);
  const { data, usingFallback } = await listMaterials();

  return (
    <AppShell role={role}>
      <MaterialsManager initialMaterials={data} usingFallback={usingFallback} />
    </AppShell>
  );
}
