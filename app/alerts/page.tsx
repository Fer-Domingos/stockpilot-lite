import { redirect } from 'next/navigation';

export default function AlertsPage({
  searchParams
}: {
  searchParams: { role?: string };
}) {
  const roleQuery = searchParams.role ? `?role=${encodeURIComponent(searchParams.role)}` : '';
  redirect(`/po-alerts${roleQuery}`);
}
