import { loginAction } from '@/app/login/actions';

export default function LoginPage({
  searchParams
}: {
  searchParams?: { error?: string };
}) {
  const hasError = searchParams?.error === 'invalid_credentials';

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <p className="brand-kicker">StockPilot</p>
        <h1>Cabinet Inventory Cloud</h1>
        <p>Sign in and choose whether to continue as an Admin or PM.</p>
        <form action={loginAction}>
          <label htmlFor="email">Work Email</label>
          <input id="email" name="email" type="email" placeholder="admin@stockpilot.com" required />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" placeholder="••••••••" required />
          <label htmlFor="role">Role</label>
          <select id="role" name="role" defaultValue="ADMIN">
            <option value="ADMIN">ADMIN</option>
            <option value="PM">PM</option>
          </select>
          <button type="submit">Sign in</button>
        </form>
        {hasError ? (
          <p className="muted" style={{ marginTop: '12px', color: '#b42318' }}>
            Invalid email or password.
          </p>
        ) : null}
      </div>
    </div>
  );
}
