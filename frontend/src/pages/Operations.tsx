import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowDown, ArrowUpRight, Bot, CheckCircle2, FileDown } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Cell,
  Education,
  Empty,
  ErrorBox,
  JsonView,
  Loading,
  PageHeader,
  Pagination,
  Table,
} from '../components/ui';
import { api, date, downloadReport, human, queryClient, useData } from '../lib/api';
import type { Execution, Intel, Page, Run, Scenario, User } from '../types';
import { useAuth } from '../lib/auth';

interface Alert {
  id: string;
  title: string;
  severity: string;
  status: string;
  reason: string;
  incident_id: string | null;
  created_at: string;
}
interface Audit {
  id: string;
  actor: string;
  action: string;
  resource: string;
  result: string;
  ip: string;
  created_at: string;
}
interface Report {
  id: string;
  incident_id: string;
  created_at: string;
  status_snapshot: string;
}
interface Playbook {
  id: string;
  name: string;
  enabled: boolean;
  actions: string[];
}

export default function Operations() {
  const path = useLocation().pathname;
  const [page, setPage] = useState(1);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const alerts = useData<Page<Alert>>(`/soc/alerts?page=${page}`, path === '/soc/alerts');
  const audit = useData<Page<Audit>>(`/admin/audit?page=${page}`, path === '/system/audit');
  const reports = useData<Report[]>('/soc/reports', path === '/soc/reports');
  const history = useData<Execution[]>('/soc/response-history', path === '/response/history');
  const playbooks = useData<Playbook[]>('/soc/playbooks', path === '/soc/playbooks');
  const runs = useData<Run[]>('/simulations', path === '/simulation/history');
  const intel = useData<Intel[]>('/soc/threat-intel', path === '/soc/threat-intel');
  const health = useData<Record<string, string>>('/admin/health', path === '/system/health');
  const users = useData<User[]>('/admin/users', path === '/system/users');
  const scenarios = useData<Scenario[]>('/scenarios', path === '/system/health');
  const title = (
    {
      '/soc/alerts': 'Alert queue',
      '/system/audit': 'Audit logs',
      '/soc/reports': 'Incident reports',
      '/response/history': 'Response history',
      '/soc/playbooks': 'SOAR playbooks',
      '/simulation/history': 'Simulation history',
      '/soc/threat-intel': 'Threat intelligence',
      '/system/health': 'System health',
      '/system/users': 'User management',
    } as Record<string, string>
  )[path];
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await queryClient.invalidateQueries();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const queries = [alerts, audit, reports, history, playbooks, runs, intel, health, users];
  return (
    <>
      <PageHeader
        title={title}
        description="Inspect the records and controls behind the BankGuard security workflow."
      />
      <ErrorBox error={error || queries.find((q) => q.error)?.error} />
      {path === '/soc/alerts' &&
        (alerts.data ? (
          <>
            <Table headings={['Detection', 'Severity', 'Status', 'Created', 'Incident']}>
              {alerts.data.items.map((a) => (
                <tr key={a.id}>
                  <Cell>
                    <p className="font-medium">{a.title}</p>
                    <p className="mt-2 max-w-md text-xs leading-5 text-muted">{a.reason}</p>
                  </Cell>
                  <Cell>
                    <Badge value={a.severity} />
                  </Cell>
                  <Cell>
                    <Badge value={a.status} />
                  </Cell>
                  <Cell mono>{date(a.created_at)}</Cell>
                  <Cell>
                    {a.incident_id ? (
                      <Button asChild variant="ghost">
                        <Link to={`/soc/incidents/${a.incident_id}`}>
                          Investigate
                          <ArrowUpRight size={14} />
                        </Link>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted">Standalone signal</span>
                    )}
                  </Cell>
                </tr>
              ))}
            </Table>
            <Pagination page={page} total={alerts.data.total} setPage={setPage} />
          </>
        ) : (
          <Loading />
        ))}
      {path === '/system/audit' &&
        (audit.data ? (
          <>
            <Table headings={['Timestamp', 'Actor', 'Action', 'Resource', 'Result', 'IP']}>
              {audit.data.items.map((a) => (
                <tr key={a.id}>
                  <Cell mono>{date(a.created_at)}</Cell>
                  <Cell>{a.actor}</Cell>
                  <Cell>{human(a.action)}</Cell>
                  <Cell mono>{a.resource}</Cell>
                  <Cell>
                    <Badge value={a.result} />
                  </Cell>
                  <Cell mono>{a.ip}</Cell>
                </tr>
              ))}
            </Table>
            <Pagination page={page} total={audit.data.total} setPage={setPage} />
          </>
        ) : (
          <Loading />
        ))}
      {path === '/soc/reports' &&
        (reports.data ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {reports.data.map((r) => (
              <Card key={r.id}>
                <div className="flex justify-between gap-3">
                  <h2 className="font-semibold">BG-{r.incident_id.slice(0, 8).toUpperCase()}</h2>
                  <Badge value={r.status_snapshot} />
                </div>
                <p className="mt-3 text-xs text-muted">Snapshot created {date(r.created_at)}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void act(() => downloadReport(r.incident_id))}
                  >
                    <FileDown size={15} />
                    Generate latest PDF
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link to={`/soc/incidents/${r.incident_id}`}>Investigation</Link>
                  </Button>
                </div>
              </Card>
            ))}
            {!reports.data.length && <Empty />}
          </div>
        ) : (
          <Loading />
        ))}
      {path === '/soc/playbooks' &&
        (playbooks.data ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {playbooks.data.map((p) => (
              <Card key={p.id}>
                <div className="mb-6 flex items-center gap-3">
                  <Bot size={24} className="text-brand" />
                  <div>
                    <h2 className="font-semibold">{p.name}</h2>
                    <p className="mt-1 text-xs text-muted">
                      Automatic at critical risk · manual for analyst response
                    </p>
                  </div>
                </div>
                <div className="mb-3 rounded-lg border border-medium/30 bg-medium/5 p-4 text-sm text-medium">
                  Risk gate: incident meets configured critical threshold
                </div>
                {p.actions.map((a) => (
                  <div key={a}>
                    <ArrowDown size={16} className="mx-auto my-2 text-muted" />
                    <div className="flex items-center gap-3 rounded-lg border border-line bg-background p-4 text-sm">
                      <CheckCircle2 size={16} className="text-brand" />
                      {human(a)}
                    </div>
                  </div>
                ))}
                <p className="mt-5 text-xs leading-5 text-muted">
                  Execute this playbook from an incident’s Response tab. Successful runs are
                  idempotent; repeating a completed run does not duplicate state changes.
                </p>
              </Card>
            ))}
            <Education
              title="SOAR, explained"
              what="Security Orchestration, Automation and Response turns a decision into a sequence of controlled actions."
              why="Automation makes response repeatable. Every action stores its execution status, timing, result and error."
              decision="Review the response history and verify the affected account state, rather than trusting a success label alone."
            />
          </div>
        ) : (
          <Loading />
        ))}
      {path === '/response/history' &&
        (history.data ? (
          <div className="space-y-5">
            {history.data.map((e) => (
              <Card key={e.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link
                    className="font-semibold hover:text-brand"
                    to={`/soc/incidents/${e.incident_id}`}
                  >
                    Incident BG-{e.incident_id.slice(0, 8).toUpperCase()}
                  </Link>
                  <div className="flex gap-2">
                    <Badge value={e.mode} />
                    <Badge value={e.status} />
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted">
                  {date(e.created_at)} · Duration{' '}
                  {(
                    (new Date(e.completed_at).getTime() - new Date(e.created_at).getTime()) /
                    1000
                  ).toFixed(3)}
                  s
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {e.actions.map((a) => (
                    <details key={a.id} className="rounded-lg border border-line p-3">
                      <summary className="text-xs">
                        <span className="mr-2">{human(a.action)}</span>
                        <Badge value={a.status} />
                      </summary>
                      <div className="mt-3">
                        <JsonView data={a.result} />
                        <ErrorBox error={a.error} />
                      </div>
                    </details>
                  ))}
                </div>
              </Card>
            ))}
            {!history.data.length && <Empty />}
          </div>
        ) : (
          <Loading />
        ))}
      {path === '/simulation/history' &&
        (runs.data ? (
          <Table headings={['Scenario', 'Started', 'Progress', 'Status', 'Risk', 'Investigation']}>
            {runs.data.map((r) => (
              <tr key={r.id}>
                <Cell>
                  {r.name}
                  <p className="mt-1 text-xs text-muted">
                    {r.guided ? 'Guided learning' : 'Automatic playback'}
                  </p>
                </Cell>
                <Cell mono>{date(r.created_at)}</Cell>
                <Cell>
                  {r.step} / {r.total_steps}
                </Cell>
                <Cell>
                  <Badge value={r.status} />
                </Cell>
                <Cell>{r.risk_score}</Cell>
                <Cell>
                  {r.incident_id ? (
                    <Button asChild variant="ghost">
                      <Link to={`/soc/incidents/${r.incident_id}`}>
                        Open
                        <ArrowUpRight size={14} />
                      </Link>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted">No incident</span>
                  )}
                </Cell>
              </tr>
            ))}
          </Table>
        ) : (
          <Loading />
        ))}
      {path === '/soc/threat-intel' &&
        (intel.data ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {intel.data.map((i) => (
              <Card key={i.ip}>
                <h2 className="font-mono text-xl">{i.ip}</h2>
                <div className="my-5 flex flex-wrap gap-2">
                  <Badge value={i.reputation} />
                  <Badge value={i.status} />
                </div>
                <p className="text-sm text-muted">Confidence: {i.confidence}%</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {i.tags.map((t) => (
                    <Badge key={t} value={t} />
                  ))}
                </div>
                <p className="mt-5 text-xs leading-5 text-muted">
                  Synthetic intelligence using a reserved documentation IP. This is not a claim
                  about a real threat actor.
                </p>
              </Card>
            ))}
          </div>
        ) : (
          <Loading />
        ))}
      {path === '/system/health' &&
        (health.data ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(health.data).map(([name, value]) => (
                <Card key={name}>
                  <h2 className="mb-4 text-sm font-semibold">{human(name)}</h2>
                  <Badge value={value} />
                </Card>
              ))}
            </div>
            <Card className="mt-6">
              <h2 className="mb-4 font-semibold">Scenario availability</h2>
              <div className="space-y-3">
                {scenarios.data?.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3 text-sm"
                  >
                    <span>{s.name}</span>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        void act(() => api(`/scenarios/${s.id}`, 'PATCH', { enabled: !s.enabled }))
                      }
                    >
                      {s.enabled ? 'Disable scenario' : 'Enable scenario'}
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </>
        ) : (
          <Loading />
        ))}
      {path === '/system/users' &&
        (users.data ? (
          <Table headings={['User', 'Email', 'Role', 'Status', 'Manage']}>
            {users.data.map((u) => (
              <tr key={u.id}>
                <Cell>
                  {u.name}
                  <p className="mt-1 text-xs text-muted">{u.customer_id}</p>
                </Cell>
                <Cell>{u.email}</Cell>
                <Cell>
                  <Badge value={u.role.toUpperCase()} />
                </Cell>
                <Cell>
                  <Badge value={u.enabled ? 'ACTIVE' : 'DISABLED'} />
                </Cell>
                <Cell>
                  <Button
                    variant="secondary"
                    disabled={busy || u.id === user?.id}
                    onClick={() =>
                      void act(() => api(`/admin/users/${u.id}`, 'PATCH', { enabled: !u.enabled }))
                    }
                  >
                    {u.enabled ? 'Disable user' : 'Enable user'}
                  </Button>
                </Cell>
              </tr>
            ))}
          </Table>
        ) : (
          <Loading />
        ))}
    </>
  );
}
