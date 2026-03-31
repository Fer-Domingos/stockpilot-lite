import { redirect } from 'next/navigation';

export default function AlertsPage({
  searchParams
}: {
  searchParams: { role?: string; error?: string; success?: string };
}) {
  const params = new URLSearchParams();

  if (searchParams.role) params.set('role', searchParams.role);
  if (searchParams.error) params.set('error', searchParams.error);
  if (searchParams.success) params.set('success', searchParams.success);

  const query = params.toString();
  redirect(query ? `/po-alerts?${query}` : '/po-alerts');
}
