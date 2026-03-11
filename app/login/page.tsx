import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h1>StockPilot Lite</h1>
        <p>Simple inventory control for cabinet shops.</p>
        <form action="/dashboard">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" placeholder="manager@shop.com" required />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" placeholder="••••••••" required />
          <button type="submit">Sign in</button>
        </form>
        <p style={{ marginTop: '10px', fontSize: '14px' }}>
          Demo login only. Go directly to <Link href="/dashboard">Dashboard</Link>.
        </p>
      </div>
    </div>
  );
}
