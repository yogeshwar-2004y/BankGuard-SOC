import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Cell,
  Empty,
  ErrorBox,
  Loading,
  PageHeader,
  Pagination,
  Table,
} from '../components/ui';
import { date, useData } from '../lib/api';
import type { Incident, Page } from '../types';

export default function Incidents() {
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, isPending } = useData<Page<Incident>>(
    `/soc/incidents?severity=${severity}&status=${status}&page=${page}`,
  );
  return (
    <>
      <PageHeader
        title="Incident queue"
        description="Investigate correlated activity, connect the evidence and document your response."
      />
      <Card className="mb-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:max-w-xl">
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
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {[
                'NEW',
                'TRIAGED',
                'INVESTIGATING',
                'CONTAINED',
                'REMEDIATING',
                'RESOLVED',
                'CLOSED',
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
      </Card>
      <ErrorBox error={error} />
      {isPending ? (
        <Loading />
      ) : data?.items.length ? (
        <>
          <Table
            headings={[
              'Incident',
              'Severity / risk',
              'Customer / account',
              'Status',
              'Assigned analyst',
              'Created',
              'Open',
            ]}
          >
            {data.items.map((i) => (
              <tr key={i.id} className="hover:bg-elevated/40">
                <Cell>
                  <Link to={`/soc/incidents/${i.id}`} className="font-medium hover:text-brand">
                    {i.title}
                  </Link>
                  <p className="mt-1 font-mono text-xs text-muted">
                    BG-{i.id.slice(0, 8).toUpperCase()}
                  </p>
                </Cell>
                <Cell>
                  <Badge value={i.severity} />
                  <p className="mt-2 text-xs text-muted">{i.risk_score} points</p>
                </Cell>
                <Cell>
                  {i.customer?.name}
                  <p className="mt-1 text-xs text-muted">{i.account?.number}</p>
                </Cell>
                <Cell>
                  <Badge value={i.status} />
                </Cell>
                <Cell>{i.analyst?.name || 'Unassigned'}</Cell>
                <Cell mono>{date(i.created_at)}</Cell>
                <Cell>
                  <Button variant="ghost" asChild>
                    <Link
                      to={`/soc/incidents/${i.id}`}
                      aria-label={`Investigate incident ${i.id.slice(0, 8)}`}
                    >
                      <ArrowUpRight size={18} />
                    </Link>
                  </Button>
                </Cell>
              </tr>
            ))}
          </Table>
          <Pagination page={page} total={data.total} setPage={setPage} />
        </>
      ) : (
        <Empty />
      )}
    </>
  );
}
