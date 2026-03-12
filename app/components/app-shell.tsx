import Link from 'next/link';
import { Navigation } from '@/app/components/navigation';
import { AppRole, rolePermissions } from '@/lib/demo-data';

export function AppShell({ children, role }: { children: React.ReactNode; role: AppRole }) {
  const isEngineer = role === 'Engineer / PM';

  return (
    <div className="app-shell">
      <Navigation />
      <section className="content-shell">
        <header className="top-header card">
          <div>
            <p className="muted">Cabinet Shop Inventory Platform</p>
            <h1>StockPilot Lite</h1>
          </div>
          <div className="header-actions">
            <span className={`role-pill ${isEngineer ? 'engineer' : 'admin'}`}>{role}</span>
            <Link
              className="ghost-button"
              href={{ pathname: '/dashboard', query: { role: isEngineer ? 'Admin' : 'Engineer / PM' } }}
            >
              Switch to {isEngineer ? 'Admin' : 'Engineer / PM'}
            </Link>
          </div>
        </header>
        <div className="role-note card">
          <strong>Role permissions:</strong> {rolePermissions[role]}
        </div>
        <main className="main">{children}</main>
      </section>
    </div>
  );
}
