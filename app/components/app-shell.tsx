import { Navigation } from '@/app/components/navigation';
import { getActiveAlertCount } from '@/app/actions';
import { logoutAction } from '@/app/logout/actions';
import { AppRole, rolePermissions } from '@/lib/demo-data';
import { getCurrentAppVersion } from '@/lib/app-version';
import { UpdateAvailableBanner } from '@/app/components/update-available-banner';

export async function AppShell({ children, role }: { children: React.ReactNode; role: AppRole }) {
  const isPm = role === 'PM';
  const activeAlertCount = await getActiveAlertCount(role);
  const currentVersion = getCurrentAppVersion();

  return (
    <div className="app-shell">
      <Navigation activeAlertCount={activeAlertCount} role={role} />
      <section className="content-shell">
        <UpdateAvailableBanner currentVersion={currentVersion} />
        <header className="top-header card">
          <div>
            <p className="muted">Cabinet Shop Inventory Platform</p>
            <h1>StockPilot Lite</h1>
          </div>
          <div className="header-actions">
            <span className={`role-pill ${isPm ? 'engineer' : 'admin'}`}>{role}</span>
            <form className="logout-form" action={logoutAction}>
              <button className="logout-button" type="submit" aria-label="Log out and return to login">
                Logout
              </button>
            </form>
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
