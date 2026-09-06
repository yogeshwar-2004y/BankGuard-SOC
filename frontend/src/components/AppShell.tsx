import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Bot,
  ChevronRight,
  CreditCard,
  FileText,
  FlaskConical,
  Gauge,
  Globe,
  History,
  LayoutDashboard,
  ListFilter,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { queryClient } from '../lib/api';
import { Button, cn, Modal } from './ui';

const sections: { name: string; items: [string, string, LucideIcon][] }[] = [
  {
    name: 'WORKSPACE',
    items: [
      ['/', 'Overview', BookOpen],
      ['/soc/dashboard', 'SOC dashboard', LayoutDashboard],
    ],
  },
  {
    name: 'DETECT & INVESTIGATE',
    items: [
      ['/soc/events', 'Live events', Activity],
      ['/soc/alerts', 'Alerts', ShieldCheck],
      ['/soc/incidents', 'Incidents', ListFilter],
      ['/soc/detections', 'Detection rules', Gauge],
      ['/soc/hunting', 'Threat hunting', Search],
      ['/soc/threat-intel', 'Threat intelligence', Globe],
      ['/soc/reports', 'Reports', FileText],
    ],
  },
  {
    name: 'RESPOND',
    items: [
      ['/soc/playbooks', 'SOAR playbooks', Bot],
      ['/response/history', 'Response history', History],
    ],
  },
  {
    name: 'SIMULATE',
    items: [
      ['/simulation', 'Attack scenarios', FlaskConical],
      ['/simulation/history', 'Simulation history', History],
    ],
  },
  {
    name: 'BANKGUARD BANK',
    items: [
      ['/banking', 'Accounts', CreditCard],
      ['/banking/transactions', 'Transactions', Activity],
      ['/banking/beneficiaries', 'Beneficiaries', Users],
    ],
  },
  {
    name: 'SYSTEM',
    items: [
      ['/system/audit', 'Audit logs', History],
      ['/system/health', 'System health', Gauge],
      ['/system/users', 'User management', Users],
    ],
  },
];

export default function AppShell() {
  const { user, logout, clear } = useAuth();
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const [term, setTerm] = useState('');
  const [live, setLive] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    setMobile(false);
    document.getElementById('main-content')?.focus();
  }, [location.pathname]);
  useEffect(() => {
    if (user?.role === 'customer') return;
    const source = new EventSource('/api/stream');
    let timer: ReturnType<typeof setTimeout> | undefined;
    source.onopen = () => setLive(true);
    source.onerror = () => setLive(false);
    source.addEventListener('expired', () => {
      source.close();
      clear();
    });
    source.addEventListener('update', () => {
      setLive(true);
      if (!timer)
        timer = setTimeout(() => {
          void queryClient.invalidateQueries();
          timer = undefined;
        }, 250);
    });
    return () => {
      source.close();
      if (timer) clearTimeout(timer);
    };
  }, [user?.id]);
  const allowed = (path: string) =>
    user?.role === 'customer'
      ? path === '/' || path.startsWith('/banking')
      : !(['/system/health', '/system/users'].includes(path) && user?.role !== 'admin');
  const nav = (
    <>
      <div className="flex h-20 items-center gap-3 border-b border-line px-6">
        <div className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <ShieldCheck size={25} />
        </div>
        <div>
          <p className="text-base font-bold tracking-[.13em]">BANKGUARD</p>
          <p className="mt-0.5 text-[10px] tracking-[.24em] text-muted">SECURITY OPERATIONS</p>
        </div>
      </div>
      <nav aria-label="Main navigation" className="flex-1 space-y-6 overflow-y-auto px-3 py-6">
        {sections.map((s) => {
          const items = s.items.filter(([path]) => allowed(path));
          return (
            items.length > 0 && (
              <div key={s.name}>
                <p className="mb-2 px-3 text-[10px] font-semibold tracking-[.14em] text-muted">
                  {s.name}
                </p>
                {items.map(([path, label, Icon]) => (
                  <NavLink
                    key={path}
                    to={path}
                    end
                    className={({ isActive }) =>
                      cn(
                        'my-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13px] transition-colors',
                        isActive
                          ? 'bg-brand/10 font-medium text-brand'
                          : 'text-muted hover:bg-elevated hover:text-ink',
                      )
                    }
                  >
                    <Icon size={17} />
                    {label}
                  </NavLink>
                ))}
              </div>
            )
          );
        })}
      </nav>
      <div className="border-t border-line p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-elevated text-xs font-bold">
            {user?.name
              .split(' ')
              .map((x) => x[0])
              .join('')
              .slice(0, 2)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{user?.name}</p>
            <p className="text-[11px] capitalize text-muted">{user?.role} workspace</p>
          </div>
          <Button
            variant="ghost"
            className="px-2"
            aria-label="Sign out"
            onClick={() => void logout()}
          >
            <LogOut size={16} />
          </Button>
        </div>
      </div>
    </>
  );
  return (
    <div className="min-h-dvh">
      <a
        href="#main-content"
        className="sr-only z-50 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-lg focus:bg-brand focus:p-3 focus:text-background"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
        {nav}
      </aside>
      <Modal open={mobile} onOpenChange={setMobile} title="Navigation">
        <div className="flex max-h-[65vh] flex-col">{nav}</div>
      </Modal>
      <div className="min-w-0 lg:ml-64">
        <div className="flex min-h-20 items-center justify-between gap-4 border-b border-line px-4 md:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="px-2 lg:hidden"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </Button>
            <span className="hidden text-xs text-muted sm:inline">Workspace</span>
            <ChevronRight size={14} className="hidden text-muted sm:block" />
            <span className="text-xs font-medium">BankGuard SOC</span>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              className="px-2"
              aria-label="Search workspace"
              onClick={() => setSearch(true)}
            >
              <Search size={18} />
              <span className="hidden sm:inline">Search workspace</span>
            </Button>
            <span className="hidden rounded-md border border-line px-2 py-1 text-[10px] font-semibold tracking-wider text-muted sm:inline">
              SYNTHETIC LAB
            </span>
            <span className="flex items-center gap-2 text-xs text-muted">
              <span className={cn('size-1.5 rounded-full', live ? 'bg-brand' : 'bg-medium')} />
              {user?.role === 'customer' ? 'Demo' : live ? 'Live' : 'Connecting'}
            </span>
          </div>
        </div>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-[1760px] p-4 outline-none md:p-8 xl:p-10"
        >
          <Outlet />
        </main>
        <footer className="mx-4 flex flex-wrap justify-between gap-2 border-t border-line py-5 text-[11px] text-muted md:mx-8">
          <span>BankGuard SOC · Real-World Banking Fraud Defense — End to End</span>
          <span>Isolated simulation. Synthetic data only.</span>
        </footer>
      </div>
      <Modal open={search} onOpenChange={setSearch} title="Search workspace">
        <label>
          Find a page
          <input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Incidents, simulation, banking…"
          />
        </label>
        <div className="mt-4 space-y-1">
          {sections
            .flatMap((s) => s.items)
            .filter(
              ([path, label]) => allowed(path) && label.toLowerCase().includes(term.toLowerCase()),
            )
            .map(([path, label, Icon]) => (
              <button
                key={path}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-elevated"
                onClick={() => {
                  navigate(path);
                  setSearch(false);
                }}
              >
                <Icon size={17} />
                {label}
                <ArrowUpRight size={15} className="ml-auto text-muted" />
              </button>
            ))}
        </div>
        <Button variant="ghost" onClick={() => setSearch(false)}>
          <X size={15} />
          Close
        </Button>
      </Modal>
    </div>
  );
}
