import { useState, type FormEvent } from 'react';
import { ShieldCheck, ArrowRight, LockKeyhole, Check } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Badge, Button, Card, ErrorBox } from '../components/ui';

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('analyst@bankguard.test');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  if (user) return <Navigate to={user.role === 'customer' ? '/banking' : '/'} replace />;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <section className="flex flex-col justify-between border-b border-line bg-surface p-8 lg:border-b-0 lg:border-r lg:p-16">
        <div className="flex items-center gap-3 text-xl font-bold tracking-widest">
          <ShieldCheck className="text-brand" size={34} />
          BANKGUARD
        </div>
        <div className="my-12 max-w-lg">
          <Badge value="SYNTHETIC SECURITY LAB" />
          <h1 className="mt-7 text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            Understand the attack.
            <br />
            <span className="text-brand">Own the response.</span>
          </h1>
          <p className="mt-6 text-base leading-7 text-muted">
            A complete banking fraud story, from the first suspicious signal to the final
            containment action.
          </p>
          <div className="mt-9 space-y-4">
            {[
              'Investigate live security telemetry',
              'Connect the signals behind account takeover',
              'Watch automated response protect the account',
            ].map((s) => (
              <p key={s} className="flex items-center gap-3 text-sm">
                <Check size={16} className="text-brand" />
                {s}
              </p>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted">
          No real accounts. No real credentials. No real transactions.
        </p>
      </section>
      <section className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex size-12 items-center justify-center rounded-xl border border-line bg-surface">
            <LockKeyhole size={23} className="text-brand" />
          </div>
          <h2 className="text-2xl font-semibold">Welcome to the control room</h2>
          <p className="mb-8 mt-3 text-sm text-muted">Sign in to your BankGuard demo workspace.</p>
          <form onSubmit={submit} className="space-y-5">
            <label>
              Email address
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <ErrorBox error={error} />
            <Button className="w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in to workspace'}
              <ArrowRight size={17} />
            </Button>
          </form>
          <Card className="mt-8">
            <p className="text-xs font-semibold tracking-wide">DEMO ACCESS</p>
            <p className="mt-3 text-sm leading-6 text-muted">
              Choose analyst, admin or customer using the credentials in <code>.env.example</code>{' '}
              and the README.
            </p>
            <p className="mt-3 text-xs text-muted">
              Default analyst password: <code className="text-ink">Analyst-demo-123!</code>
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
}
