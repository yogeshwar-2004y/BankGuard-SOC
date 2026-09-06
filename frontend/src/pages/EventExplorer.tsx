import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';
import { EventTable } from '../components/Events';
import {
  Button,
  Card,
  Education,
  ErrorBox,
  Loading,
  PageHeader,
  Pagination,
} from '../components/ui';
import { useData } from '../lib/api';
import type { Page, SecurityEvent } from '../types';

export default function EventExplorer() {
  const hunting = useLocation().pathname.includes('hunting');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [type, setType] = useState('');
  const [severity, setSeverity] = useState('');
  const [customer, setCustomer] = useState('');
  const [ip, setIp] = useState('');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [hunt, setHunt] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const params = new URLSearchParams({
    q: debounced,
    event_type: type,
    severity,
    user_id: customer,
    ip,
    page: String(page),
    hunt,
  });
  if (since) params.set('since', new Date(since).toISOString());
  if (until) params.set('until', new Date(until).toISOString());
  const { data, error, isPending } = useData<Page<SecurityEvent>>(`/soc/events?${params}`);
  const reset = () => {
    setQ('');
    setType('');
    setSeverity('');
    setCustomer('');
    setIp('');
    setSince('');
    setUntil('');
    setHunt('');
    setPage(1);
  };
  return (
    <>
      <PageHeader
        title={hunting ? 'Threat hunting' : 'Live event explorer'}
        description={
          hunting
            ? 'Ask focused questions of your telemetry. Start with a hypothesis, then inspect the evidence.'
            : 'Search normalized telemetry from banking, detection and response. New activity arrives over the live stream.'
        }
      />
      {hunting && (
        <Card className="mb-5">
          <h2 className="mb-4 text-sm font-semibold">Start a hunt</h2>
          <div className="flex flex-wrap gap-2">
            {[
              ['Login failures · BG1001', 'LOGIN_FAILURE'],
              ['Large transfers', 'LARGE_TRANSFER_DETECTED'],
              ['New devices', 'NEW_DEVICE'],
              ['Suspicious password changes', 'PASSWORD_CHANGED'],
            ].map(([title, value]) => (
              <Button
                key={title}
                variant="secondary"
                onClick={() => {
                  reset();
                  setType(value);
                  if (value === 'LOGIN_FAILURE') setCustomer('BG1001');
                  if (value === 'PASSWORD_CHANGED') setHunt('password-after-login');
                }}
              >
                {title}
              </Button>
            ))}
            <Button
              variant="secondary"
              onClick={() => {
                reset();
                setIp('203.0.113.50');
              }}
            >
              Known suspicious IP
            </Button>
          </div>
        </Card>
      )}
      <Card className="mb-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="xl:col-span-2">
            Search events
            <div className="relative">
              <Search size={16} className="absolute left-3 top-3.5 text-muted" />
              <input
                className="pl-10"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Event, customer name, ID or IP…"
              />
            </div>
          </label>
          <label>
            Event type
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All event types</option>
              {[
                'LOGIN_SUCCESS',
                'LOGIN_FAILURE',
                'NEW_DEVICE',
                'UNUSUAL_LOCATION',
                'PASSWORD_CHANGED',
                'NEW_BENEFICIARY',
                'TRANSFER_INITIATED',
                'LARGE_TRANSFER_DETECTED',
                'ATO_CORRELATION',
                'ACCOUNT_LOCKED',
                'TRANSACTION_FROZEN',
                'IP_BLOCKED',
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Severity
            <select
              value={severity}
              onChange={(e) => {
                setSeverity(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All severities</option>
              {['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Customer ID
            <input
              value={customer}
              onChange={(e) => {
                setCustomer(e.target.value);
                setPage(1);
              }}
              placeholder="BG1001"
            />
          </label>
          <label>
            Source IP
            <input
              value={ip}
              onChange={(e) => {
                setIp(e.target.value);
                setPage(1);
              }}
              placeholder="203.0.113.50"
            />
          </label>
          <label>
            From
            <input
              type="datetime-local"
              value={since}
              onChange={(e) => {
                setSince(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Until
            <input
              type="datetime-local"
              value={until}
              onChange={(e) => {
                setUntil(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
        <Button variant="ghost" className="mt-3" onClick={reset}>
          Clear filters
        </Button>
      </Card>
      <ErrorBox error={error} />
      {isPending ? (
        <Loading />
      ) : (
        data && (
          <>
            <EventTable events={data.items} />
            <Pagination page={page} total={data.total} setPage={setPage} />
          </>
        )
      )}
      <div className="mt-6">
        <Education
          title="SIEM, explained"
          what="A Security Information and Event Management system collects, normalizes, searches and correlates security telemetry. BankGuard implements this using indexed relational event storage."
          why="The event explorer shows the underlying evidence rather than only a dashboard total."
          decision="Select an event to inspect its raw structured data, then connect related activity in the incident timeline."
        />
      </div>
    </>
  );
}
