import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Square,
} from 'lucide-react';
import { EventTable } from '../components/Events';
import {
  Badge,
  Button,
  Card,
  Education,
  ErrorBox,
  Loading,
  Modal,
  PageHeader,
  Risk,
} from '../components/ui';
import { api, downloadReport, queryClient, useData } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { IncidentDetail, Page, Run, Scenario, SecurityEvent } from '../types';

export default function Simulation() {
  const [search] = useSearchParams();
  const { user, clear } = useAuth();
  const [guided, setGuided] = useState(search.get('guided') === 'true');
  const [selected, setSelected] = useState('ato');
  const [runId, setRunId] = useState<string | null>(sessionStorage.getItem('bankguard-run'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [reset, setReset] = useState(false);
  const scenarios = useData<Scenario[]>('/scenarios');
  const runs = useData<Run>(`/simulations/${runId}`, !!runId);
  const run = runs.data;
  const events = useData<Page<SecurityEvent>>(
    `/soc/events?run_id=${runId}&limit=100`,
    !!runId && !!run,
  );
  const detail = useData<IncidentDetail>(`/soc/incidents/${run?.incident_id}`, !!run?.incident_id);
  const active = !!run && ['RUNNING', 'PAUSED'].includes(run.status);
  const scenario = scenarios.data?.find((s) => s.slug === selected);
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
  const launch = () =>
    act(async () => {
      const r = await api<Run>('/simulations', 'POST', { scenario: selected, guided });
      setRunId(r.id);
      sessionStorage.setItem('bankguard-run', r.id);
    });
  const control = (action: string) => act(() => api(`/simulations/${runId}/${action}`, 'POST'));
  const incident = detail.data?.incident;
  const contained = incident?.status === 'CONTAINED' && run?.status === 'COMPLETED';
  const lesson = run?.lessons[Math.min(Math.max(run.step - 1, 0), run.total_steps - 1)];
  const timeToDetect =
    incident && run
      ? Math.max(
          0,
          (new Date(incident.created_at).getTime() - new Date(run.created_at).getTime()) / 1000,
        )
      : null;
  const timeToContain = incident?.contained_at
    ? Math.max(
        0,
        (new Date(incident.contained_at).getTime() - new Date(incident.created_at).getTime()) /
          1000,
      )
    : null;
  if (scenarios.isPending) return <Loading />;
  return (
    <>
      <PageHeader
        eyebrow="BANKGUARD / SIMULATION LAB"
        title="Attack simulation center"
        description="Launch a safe attack. Follow the evidence. See exactly how BankGuard responds."
        action={
          user?.role === 'admin' && (
            <Button variant="secondary" onClick={() => setReset(true)}>
              <RotateCcw size={16} />
              Reset Demo Environment
            </Button>
          )
        }
      />
      <ErrorBox error={error || scenarios.error} />
      {runId && runs.error && (
        <Card className="mb-5">
          <p className="text-sm text-muted">
            The previous run is no longer available, possibly after a reset.
          </p>
          <Button
            className="mt-3"
            variant="secondary"
            onClick={() => {
              setRunId(null);
              sessionStorage.removeItem('bankguard-run');
            }}
          >
            Clear previous run
          </Button>
        </Card>
      )}
      {contained && (
        <Card className="mb-7 border-brand/40 bg-brand/5">
          <div className="flex flex-wrap items-center gap-5">
            <span className="flex size-16 items-center justify-center rounded-full border border-brand/40 bg-brand/10 text-brand">
              <ShieldCheck size={34} />
            </span>
            <div className="flex-1">
              <p className="text-xs font-semibold tracking-widest text-brand">INCIDENT CONTAINED</p>
              <h2 className="mt-2 text-3xl font-semibold">Fraud prevented.</h2>
              <p className="mt-2 text-sm text-muted">
                BankGuard stopped the simulated fraudulent transfer before settlement.
              </p>
            </div>
            <Badge value="CRITICAL ATO" />
          </div>
          <div className="my-6 grid gap-4 border-y border-line py-5 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted">Final correlated risk</p>
              <p className="mt-1 text-2xl font-semibold">{incident.risk_score} points</p>
            </div>
            <div>
              <p className="text-xs text-muted">Time to first incident</p>
              <p className="mt-1 text-2xl font-semibold">{timeToDetect?.toFixed(2)}s</p>
            </div>
            <div>
              <p className="text-xs text-muted">Time from incident to containment</p>
              <p className="mt-1 text-2xl font-semibold">{timeToContain?.toFixed(2)}s</p>
            </div>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              'Account locked',
              'Customer sessions revoked',
              'Suspicious transaction frozen',
              'Source IP blocked',
            ].map((s) => (
              <p key={s} className="flex items-center gap-2">
                <CheckCircle2 size={17} className="text-brand" />
                {s}
              </p>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link to={`/soc/incidents/${incident.id}`}>
                View Investigation
                <ArrowRight size={16} />
              </Link>
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void act(() => downloadReport(incident.id))}
            >
              Generate Report
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setRunId(null);
                sessionStorage.removeItem('bankguard-run');
              }}
            >
              Run Again
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted">
            Guided timing includes time spent reading. Reset the environment before attacking a
            contained account again.
          </p>
        </Card>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_1.15fr]">
        <div className="order-2 space-y-4 xl:order-1">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Scenario library</h2>
            <span className="text-xs text-muted">{scenarios.data?.length} safe scenarios</span>
          </div>
          {scenarios.data?.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s.slug)}
              disabled={active || !s.enabled}
              className={`flex w-full items-start gap-4 rounded-xl border p-5 text-left transition-colors disabled:opacity-50 ${selected === s.slug ? 'border-brand/50 bg-brand/5' : 'border-line bg-surface hover:border-muted/50'}`}
            >
              <FlaskConical
                size={20}
                className={
                  selected === s.slug ? 'mt-1 shrink-0 text-brand' : 'mt-1 shrink-0 text-muted'
                }
              />
              <div>
                <h3 className="text-sm font-semibold">{s.name}</h3>
                <p className="mt-2 text-xs leading-5 text-muted">{s.description}</p>
                <p className="mt-3 text-[11px] text-muted">
                  {s.steps.length} learning steps ·{' '}
                  {s.slug === 'ato' ? 'Intermediate' : 'Focused exercise'}
                </p>
              </div>
            </button>
          ))}
        </div>
        <div className="order-1 space-y-5 xl:order-2">
          <Card>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-widest text-brand">SCENARIO CONTROL</p>
              <Badge value={run?.status || 'READY'} />
            </div>
            <h2 className="mt-4 text-xl font-semibold">{active ? run?.name : scenario?.name}</h2>
            <p className="mt-3 text-sm leading-6 text-muted">{scenario?.description}</p>
            <label className="mt-6 flex items-center gap-3 rounded-lg border border-line p-3">
              <input
                className="size-4 min-h-0 w-4 accent-[var(--color-brand)]"
                type="checkbox"
                checked={guided}
                disabled={active}
                onChange={(e) => setGuided(e.target.checked)}
              />
              <span>
                <span className="block text-sm">Guided learning mode</span>
                <span className="mt-1 block text-xs font-normal text-muted">
                  Advance one step at a time with contextual explanations.
                </span>
              </span>
            </label>
            <div className="mt-5 flex flex-wrap gap-3">
              {!active ? (
                <Button disabled={busy || !scenario?.enabled} onClick={() => void launch()}>
                  <Play size={16} />
                  {busy ? 'Starting…' : 'Launch Simulation'}
                </Button>
              ) : (
                <>
                  {run.guided && run.status === 'RUNNING' && (
                    <Button disabled={busy} onClick={() => void control('continue')}>
                      Continue
                      <ArrowRight size={16} />
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void control(run.status === 'PAUSED' ? 'resume' : 'pause')}
                  >
                    {run.status === 'PAUSED' ? <Play size={16} /> : <Pause size={16} />}{' '}
                    {run.status === 'PAUSED' ? 'Resume' : 'Pause'}
                  </Button>
                  <Button variant="danger" disabled={busy} onClick={() => void control('stop')}>
                    <Square size={14} />
                    Stop
                  </Button>
                </>
              )}
              {run?.incident_id && (
                <Button variant="secondary" asChild>
                  <Link to={`/soc/incidents/${run.incident_id}`}>Investigate Incident</Link>
                </Button>
              )}
            </div>
          </Card>
          {run && (
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Simulation progress</h2>
                <span className="font-mono text-xs text-muted">
                  {run.step} / {run.total_steps}
                </span>
              </div>
              <progress
                className="h-2 w-full accent-[var(--color-brand)]"
                value={run.step}
                max={run.total_steps}
                aria-label="Simulation progress"
              />
              <div className="mt-5 space-y-3">
                {run.lessons.map((l, i) => (
                  <div key={l.title} className="flex items-center gap-3 text-sm">
                    <span
                      className={`flex size-6 items-center justify-center rounded-full border text-xs ${i < run.step ? 'border-brand/40 bg-brand/10 text-brand' : 'border-line text-muted'}`}
                    >
                      {i < run.step ? <CheckCircle2 size={14} /> : i + 1}
                    </span>
                    <span className={i < run.step ? 'text-ink' : 'text-muted'}>{l.title}</span>
                  </div>
                ))}
              </div>
              <ErrorBox error={run.error} />
            </Card>
          )}
          {lesson && (
            <Education
              title={`Step ${Math.max(1, run?.step || 0)} · ${lesson.title}`}
              what={lesson.what}
              why={lesson.why}
              decision={lesson.decision}
            />
          )}
          <Card>
            <Risk score={run?.risk_score || 0} factors={incident?.reasons} />
            <p className="mt-4 text-xs leading-5 text-muted">
              LOW logs activity. MEDIUM alerts. HIGH recommends response. CRITICAL triggers
              automatic containment. Thresholds and weights can be configured by an administrator.
            </p>
          </Card>
        </div>
      </div>
      {events.data && (
        <section className="mt-8">
          <h2 className="mb-4 font-semibold">This run’s live telemetry</h2>
          <EventTable events={events.data.items} />
        </section>
      )}
      <Modal
        open={reset}
        onOpenChange={setReset}
        title="Reset the demo environment?"
        description="This stops active runs, clears generated records, restores the prepared baseline and revokes all sessions. Audit history is retained."
      >
        <div className="flex flex-wrap gap-3">
          <Button
            variant="danger"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                await api('/admin/reset', 'POST', { confirmation: 'RESET BANKGUARD' });
                sessionStorage.removeItem('bankguard-run');
                clear();
              })
            }
          >
            Confirm Reset
          </Button>
          <Button variant="secondary" onClick={() => setReset(false)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </>
  );
}
