import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  FileDown,
  Fingerprint,
  Globe,
  LockKeyhole,
  Plus,
  UserRound,
} from 'lucide-react';
import { EventTable, EventTimeline } from '../components/Events';
import {
  Badge,
  Button,
  Card,
  Cell,
  Education,
  ErrorBox,
  JsonView,
  Loading,
  Modal,
  PageHeader,
  Risk,
  Table,
} from '../components/ui';
import { api, date, downloadReport, human, money, queryClient, useData } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { IncidentDetail as Detail, Note } from '../types';

const tabs = [
  'Overview',
  'Timeline',
  'Evidence',
  'Events',
  'Risk Analysis',
  'Threat Intel',
  'Response',
  'Investigation',
  'Report',
];
export default function IncidentDetail() {
  const { incidentId } = useParams();
  const { user } = useAuth();
  const { data, isPending, error } = useData<Detail>(`/soc/incidents/${incidentId}`);
  const [tab, setTab] = useState('Overview');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);
  const [noteText, setNoteText] = useState('');
  const [editing, setEditing] = useState<Note | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceText, setEvidenceText] = useState('');
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      await queryClient.invalidateQueries();
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(false);
    }
  }
  if (isPending) return <Loading />;
  if (!data) return <ErrorBox error={error} />;
  const i = data.incident;
  return (
    <>
      <Link
        to="/soc/incidents"
        className="mb-5 inline-flex min-h-11 items-center gap-2 text-xs text-muted hover:text-brand"
      >
        <ArrowLeft size={14} />
        Back to incident queue
      </Link>
      <PageHeader
        eyebrow={`INCIDENT / BG-${i.id.slice(0, 8).toUpperCase()}`}
        title={i.title}
        description={`${data.user.name} · ${data.account.number} · Detected ${date(i.created_at)}`}
        action={
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void act(() => downloadReport(i.id))}
          >
            <FileDown size={16} />
            Generate Incident Report
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface px-5 py-4">
        <div className="flex items-center gap-3">
          <Badge value={i.severity} />
          <Badge value={i.status} />
          <span className="text-xs text-muted">{i.risk_score} risk points</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            disabled={busy || i.assigned_to === user?.id}
            onClick={() =>
              void act(() => api(`/soc/incidents/${i.id}`, 'PATCH', { assigned_to: user?.id }))
            }
          >
            {i.assigned_to === user?.id ? 'Assigned to you' : 'Assign to me'}
          </Button>
          <label className="sr-only" htmlFor="incident-status">
            Update incident status
          </label>
          <select
            id="incident-status"
            className="w-auto"
            value=""
            disabled={busy || !data.allowed_statuses.length}
            onChange={(e) => {
              if (e.target.value)
                void act(() => api(`/soc/incidents/${i.id}`, 'PATCH', { status: e.target.value }));
            }}
          >
            <option value="">Update status…</option>
            {data.allowed_statuses.map((s) => (
              <option key={s} value={s}>
                {human(s)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <ErrorBox error={actionError} />
      <div
        role="tablist"
        aria-label="Incident sections"
        className="mb-6 flex max-w-full gap-1 overflow-x-auto border-b border-line"
      >
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            id={`tab-${t}`}
            aria-controls="incident-panel"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-12 whitespace-nowrap border-b-2 px-4 text-xs font-medium ${tab === t ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="incident-panel" aria-labelledby={`tab-${tab}`}>
        {tab === 'Overview' && (
          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <div className="space-y-5">
              <Card>
                <h2 className="mb-4 text-base font-semibold">Why this incident exists</h2>
                <p className="mb-5 text-sm leading-6 text-muted">
                  Independent authentication and banking signals occurred for the same customer
                  within a bounded correlation window.
                </p>
                {i.reasons.map((f) => (
                  <div key={f.key} className="mb-3 flex items-start gap-3">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand" />
                    <div>
                      <p className="text-sm font-medium">{f.name}</p>
                      <p className="mt-1 text-xs leading-5 text-muted">{f.reason}</p>
                    </div>
                  </div>
                ))}
              </Card>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    icon: UserRound,
                    title: 'Affected customer',
                    value: data.user.name,
                    sub: data.user.customer_id,
                  },
                  {
                    icon: LockKeyhole,
                    title: 'Account state',
                    value: data.account.status,
                    sub: data.account.number,
                  },
                  {
                    icon: Globe,
                    title: 'Source IP',
                    value: i.source_ip,
                    sub: data.threat_intel.reputation,
                  },
                  {
                    icon: Fingerprint,
                    title: 'Sessions',
                    value: `${data.sessions.filter((s) => s.status === 'REVOKED').length} revoked`,
                    sub: `${data.devices.length} devices recorded`,
                  },
                ].map((c) => (
                  <Card key={c.title}>
                    <c.icon size={19} className="mb-4 text-muted" />
                    <p className="text-xs text-muted">{c.title}</p>
                    <p className="mt-2 text-lg font-semibold">{c.value}</p>
                    <p className="mt-1 text-xs text-muted">{c.sub}</p>
                  </Card>
                ))}
              </div>
            </div>
            <div className="space-y-5">
              <Card>
                <Risk score={i.risk_score} factors={i.reasons} />
              </Card>
              <Education
                title={
                  i.severity === 'CRITICAL' ? 'Why it is critical' : 'Recommended analyst response'
                }
                what={
                  i.severity === 'CRITICAL'
                    ? 'Multiple signals crossed the critical risk threshold. The built-in SOAR playbook automatically contained the account.'
                    : 'The correlated score warrants investigation. Automatic containment is reserved for critical risk.'
                }
                decision="Review the timeline, validate the evidence, verify all response actions, then remediate and document the incident."
              />
              <Card>
                <h2 className="mb-4 text-sm font-semibold">Containment checklist</h2>
                {['LOCK_ACCOUNT', 'REVOKE_SESSION', 'FREEZE_TRANSACTION', 'BLOCK_IP'].map(
                  (action) => (
                    <div key={action} className="mb-3 flex justify-between gap-3 text-sm">
                      <span>{human(action)}</span>
                      <Badge
                        value={
                          data.response_actions.some(
                            (a) => a.action === action && a.status === 'SUCCESS',
                          )
                            ? 'SUCCESS'
                            : 'RECOMMENDED'
                        }
                      />
                    </div>
                  ),
                )}
              </Card>
            </div>
          </div>
        )}
        {tab === 'Timeline' && (
          <Card>
            <h2 className="mb-6 font-semibold">From initial access to containment</h2>
            <EventTimeline events={data.events} />
          </Card>
        )}
        {tab === 'Evidence' && (
          <>
            <div className="mb-5 flex items-center justify-between gap-4">
              <p className="text-sm text-muted">
                Captured snapshots with SHA-256 integrity hashes.
              </p>
              <Button variant="secondary" onClick={() => setEvidenceOpen(true)}>
                <Plus size={15} />
                Add reference
              </Button>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {data.evidence.map((e) => (
                <Card key={e.id}>
                  <Badge value={e.type} />
                  <h2 className="mt-4 text-sm font-semibold">{human(e.title)}</h2>
                  <p className="mt-2 text-xs leading-5 text-muted">
                    {e.description} · {date(e.created_at)}
                  </p>
                  <details className="mt-4 text-xs">
                    <summary className="py-2 text-brand">Inspect evidence snapshot</summary>
                    <JsonView data={e.snapshot} />
                    <p className="mt-3 break-all font-mono text-muted">SHA256: {e.sha256}</p>
                  </details>
                </Card>
              ))}
            </div>
          </>
        )}
        {tab === 'Events' && <EventTable events={data.events} />}
        {tab === 'Risk Analysis' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <Risk score={i.risk_score} factors={i.reasons} />
            </Card>
            <Education
              title="Correlation, explained"
              what="The engine groups stored alerts by customer, account and correlation window. Each enabled rule contributes at most once, so repeating a signal does not inflate risk indefinitely."
              why="A new device plus a password change plus a new payee tells a stronger story than any one event alone."
              decision="Scores are decision support, not a probability of compromise. Review the individual evidence and tune weights using the false-positive scenario."
            />
          </div>
        )}
        {tab === 'Threat Intel' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <Globe className="mb-5 text-brand" />
              <h2 className="font-mono text-xl">{i.source_ip}</h2>
              <div className="my-5 flex gap-3">
                <Badge value={data.threat_intel.status || 'UNKNOWN'} />
                <Badge value={data.threat_intel.reputation || 'Unknown'} />
              </div>
              <p className="text-sm text-muted">
                Confidence: <span className="text-ink">{data.threat_intel.confidence || 0}%</span>
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {data.threat_intel.tags?.map((t) => (
                  <Badge key={t} value={t} />
                ))}
              </div>
              <p className="mt-5 text-sm text-high">
                Risk contribution: +{i.reasons.find((f) => f.key === 'THREAT_INTEL')?.points || 0}{' '}
                points
              </p>
            </Card>
            <Education
              title="Local threat intelligence"
              what="Threat intelligence adds context about an IP or device. This lab uses a local synthetic reputation dataset and reserved documentation IPs."
              why="A reputation match supports other evidence but does not prove a real-world IP is malicious."
              decision="No external threat intelligence API, geolocation lookup or real network block is performed."
            />
          </div>
        )}
        {tab === 'Response' && (
          <div className="space-y-5">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Bot className="text-brand" />
                  <div>
                    <h2 className="font-semibold">Critical ATO Containment</h2>
                    <p className="mt-1 text-xs text-muted">
                      Allowlisted actions, recorded results, real simulated state changes.
                    </p>
                  </div>
                </div>
                <Button
                  disabled={busy || data.executions.some((e) => e.status === 'SUCCESS')}
                  onClick={() => void act(() => api(`/soc/incidents/${i.id}/respond`, 'POST'))}
                >
                  {data.executions.some((e) => e.status === 'SUCCESS')
                    ? 'Playbook completed'
                    : 'Run containment playbook'}
                </Button>
              </div>
              {data.executions.map((e) => (
                <div key={e.id} className="mt-4 flex flex-wrap gap-3">
                  <Badge value={e.mode} />
                  <Badge value={e.status} />
                  <span className="text-xs text-muted">{date(e.created_at)}</span>
                </div>
              ))}
            </Card>
            {data.response_actions.length ? (
              data.response_actions.map((a) => (
                <Card key={a.id}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">{human(a.action)}</h3>
                    <Badge value={a.status} />
                  </div>
                  <p className="my-3 text-xs text-muted">{date(a.created_at)}</p>
                  <JsonView data={a.result} />
                  <ErrorBox error={a.error} />
                </Card>
              ))
            ) : (
              <Education
                title="Response recommended"
                what="No playbook has executed. Review the evidence, then use the manual containment action if warranted."
              />
            )}
          </div>
        )}
        {tab === 'Investigation' && (
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <div className="space-y-5">
              <Card>
                <h2 className="mb-4 font-semibold">Investigation notes</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act(async () => {
                      await api(
                        editing ? `/soc/notes/${editing.id}` : `/soc/incidents/${i.id}/notes`,
                        editing ? 'PATCH' : 'POST',
                        { content: noteText },
                      );
                      setNoteText('');
                      setEditing(null);
                    });
                  }}
                >
                  <label>
                    {editing ? 'Edit your note' : 'Add your findings'}
                    <textarea
                      rows={5}
                      required
                      maxLength={5000}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Describe your hypothesis and the evidence supporting it…"
                    />
                  </label>
                  <div className="mt-3 flex gap-3">
                    <Button disabled={busy || !noteText.trim()}>
                      {editing ? 'Save note' : 'Add note'}
                    </Button>
                    {editing && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setEditing(null);
                          setNoteText('');
                        }}
                      >
                        Cancel edit
                      </Button>
                    )}
                  </div>
                </form>
              </Card>
              {data.notes.map((n) => (
                <Card key={n.id}>
                  <p className="whitespace-pre-wrap text-sm leading-6">{n.content}</p>
                  <p className="mt-4 text-xs text-muted">
                    {n.author_id ? 'Analyst note' : 'Automated note'} · {date(n.updated_at)}
                  </p>
                  {n.author_id === user?.id && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditing(n);
                          setNoteText(n.content);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void act(() => api(`/soc/notes/${n.id}`, 'DELETE'))}
                      >
                        Delete own note
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
            <div className="space-y-5">
              <Card>
                <h2 className="mb-4 font-semibold">Customer context</h2>
                <p className="text-sm">
                  {data.user.name} · {data.user.customer_id}
                </p>
                <p className="mt-2 text-sm text-muted">
                  {data.account.number} · {money(data.account.balance)}
                </p>
                <div className="mt-4">
                  <Badge value={data.account.status} />
                </div>
              </Card>
              <Card>
                <h2 className="mb-4 text-sm font-semibold">Sessions & devices</h2>
                {data.sessions.map((s) => (
                  <div key={s.id} className="mb-3 flex justify-between gap-3 text-xs">
                    <span className="font-mono text-muted">{s.source_ip}</span>
                    <Badge value={s.status} />
                  </div>
                ))}
                {data.devices.map((d) => (
                  <p key={d.id} className="mt-3 text-xs text-muted">
                    {d.name} · {d.trusted ? 'Trusted baseline' : 'Unrecognized device'}
                  </p>
                ))}
              </Card>
              <Card>
                <h2 className="mb-4 text-sm font-semibold">Beneficiaries</h2>
                {data.beneficiaries.map((b) => (
                  <p key={b.id} className="mt-3 text-sm">
                    {b.name}
                    <span className="mt-1 block font-mono text-xs text-muted">
                      {b.account_number}
                    </span>
                  </p>
                ))}
              </Card>
              <Table headings={['Transaction', 'Amount', 'Status']}>
                {data.transactions.map((t) => (
                  <tr key={t.id}>
                    <Cell>{t.reference}</Cell>
                    <Cell>{money(t.amount)}</Cell>
                    <Cell>
                      <Badge value={t.status} />
                    </Cell>
                  </tr>
                ))}
              </Table>
            </div>
          </div>
        )}
        {tab === 'Report' && (
          <Card>
            <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Incident report preview</h2>
              <Button disabled={busy} onClick={() => void act(() => downloadReport(i.id))}>
                <FileDown size={16} />
                Download PDF
              </Button>
            </div>
            {Object.entries(data.report).map(([title, content]) => (
              <section key={title} className="mb-7">
                <h3 className="mb-3 text-sm font-semibold text-brand">{title}</h3>
                <p className="whitespace-pre-wrap break-words text-sm leading-7 text-muted">
                  {content || 'No records captured.'}
                </p>
              </section>
            ))}
          </Card>
        )}
      </div>
      <Modal
        open={evidenceOpen}
        onOpenChange={setEvidenceOpen}
        title="Add an evidence reference"
        description="Record a description or local screenshot reference. No file is uploaded or external URL fetched."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              await api(`/soc/incidents/${i.id}/evidence`, 'POST', {
                type: 'Screenshot Reference',
                title: evidenceTitle,
                description: evidenceText,
              });
              setEvidenceOpen(false);
              setEvidenceTitle('');
              setEvidenceText('');
            });
          }}
        >
          <label>
            Title
            <input
              required
              minLength={2}
              maxLength={120}
              value={evidenceTitle}
              onChange={(e) => setEvidenceTitle(e.target.value)}
            />
          </label>
          <label>
            Description or local reference
            <textarea
              required
              minLength={2}
              maxLength={2000}
              value={evidenceText}
              onChange={(e) => setEvidenceText(e.target.value)}
            />
          </label>
          <Button disabled={busy}>Save evidence reference</Button>
          <ErrorBox error={actionError} />
        </form>
      </Modal>
    </>
  );
}
