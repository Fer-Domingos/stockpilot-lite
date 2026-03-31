'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { AppRole } from '@/lib/demo-data';

const linksByRole: Record<AppRole, Array<{ href: string; label: string; hasCounter?: boolean }>> = {
  ADMIN: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/materials', label: 'Materials' },
    { href: '/inventory', label: 'Inventory' },
    { href: '/jobs', label: 'Jobs' },
    { href: '/receive-materials', label: 'Receive Materials' },
    { href: '/transfer-materials', label: 'Transfer Materials' },
    { href: '/issue-materials', label: 'Issue Materials' },
    { href: '/po-alerts', label: 'PO Alerts', hasCounter: true },
    { href: '/history', label: 'History' },
    { href: '/reports', label: 'Reports' },
    { href: '/users', label: 'Users' },
    { href: '/account', label: 'My Account' }
  ],
  PM: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/inventory', label: 'Inventory' },
    { href: '/po-alerts', label: 'PO Alerts', hasCounter: true },
    { href: '/history', label: 'History' },
    { href: '/reports', label: 'Reports' },
    { href: '/account', label: 'My Account' }
  ]
} as const;

export function Navigation({ activeAlertCount = 0, role }: { activeAlertCount?: number; role: AppRole }) {
  const pathname = usePathname();
  const links = linksByRole[role];

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
              href={link.href}
            >
              <span>{link.label}</span>
              {link.hasCounter ? <span className="sidebar-counter">{activeAlertCount}</span> : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
