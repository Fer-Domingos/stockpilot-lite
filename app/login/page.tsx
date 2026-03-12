import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="login-wrap">
      <div className="card login-card">
        <p className="brand-kicker">StockPilot</p>
        <h1>Cabinet Inventory Cloud</h1>
        <p>Demo login for a professional inventory SaaS experience.</p>
        <form action="/dashboard">
          <label htmlFor="email">Work Email</label>
          <input id="email" type="email" placeholder="manager@cabinetco.com" required />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" placeholder="••••••••" required />
          <button type="submit">Sign in to Demo</button>
        </form>
        <p className="muted" style={{ marginTop: '12px' }}>
          Quick access: <Link href="/dashboard?role=Admin">Admin</Link> ·{' '}
          <Link href="/dashboard?role=Engineer%20%2F%20PM">Engineer / PM</Link>
        </p>
      </div>
    </div>
  );
}
