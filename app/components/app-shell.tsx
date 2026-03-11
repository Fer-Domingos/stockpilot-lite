import { Navigation } from '@/app/components/navigation';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Navigation />
      <main className="main">{children}</main>
    </div>
  );
}
