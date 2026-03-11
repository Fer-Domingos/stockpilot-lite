import Link from 'next/link';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/materials', label: 'Materials' },
  { href: '/receive-materials', label: 'Receive Materials' },
  { href: '/issue-materials', label: 'Issue Materials' },
  { href: '/history', label: 'History' }
];

export function Navigation() {
  return (
    <aside className="sidebar">
      <h2>StockPilot Lite</h2>
      <nav>
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
