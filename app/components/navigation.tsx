'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/materials', label: 'Materials' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/receive-materials', label: 'Receive Materials' },
  { href: '/transfer-materials', label: 'Transfer Materials' },
  { href: '/issue-materials', label: 'Issue Materials' },
  { href: '/po-alerts', label: 'PO Alerts' },
  { href: '/alerts', label: 'Alerts' },
  { href: '/history', label: 'History' },
  { href: '/reports', label: 'Reports' }
] as const;

export function Navigation() {
  const pathname = usePathname();
  const params = useSearchParams();
  const role = params.get('role') ?? 'Admin';

  return (
    <aside className="sidebar">
      <div className="brand">
        <p className="brand-kicker">StockPilot</p>
        <h2>Cabinet Inventory</h2>
      </div>
      <nav>
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              className={active ? 'active' : ''}
              key={link.href}
              href={{ pathname: link.href, query: { role } }}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
