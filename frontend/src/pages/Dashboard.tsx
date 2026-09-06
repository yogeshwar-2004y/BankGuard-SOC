import { Activity, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ChartCard } from '../components/Charts';
import { EventTable } from '../components/Events';
import { Button, Card, ErrorBox, Loading, PageHeader, Stat } from '../components/ui';
import { money, useData } from '../lib/api';
import type { Dashboard as DashboardData } from '../types';

export default function Dashboard() {
  const { data, error, isPending } = useData<DashboardData>('/soc/dashboard');
  if (isPending) return <Loading />;
  if (!data) return <ErrorBox error={error} />;
  return (
    <>
      <PageHeader
        title="Security overview"
        description="A live picture of banking risk, active investigations and automated protection."
        action={
          <Button asChild>
            <Link to="/simulation">
              <Zap size={16} />
              Launch a simulation
            </Link>
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-brand/20 bg-brand/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-brand" size={23} />
          <div>
            <p className="text-sm font-medium">Defense in depth, visible in action</p>
            <p className="mt-1 text-xs text-muted">
              {money(data.protected_amount)} in simulated transfers frozen by response controls
            </p>
          </div>
        </div>
        <span className="text-xs text-brand">
          {data.event_count.toLocaleString()} events ingested
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(data.stats)
          .slice(0, 4)
          .map(([label, value]) => (
            <Stat
              key={label}
              label={label}
              value={value}
              icon={<Activity size={16} />}
              hint="Current database state"
            />
          ))}
      </div>
      <div className="my-5 grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {Object.entries(data.stats)
          .slice(4)
          .map(([label, value]) => (
            <Card key={label} className="p-4">
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-3 text-2xl font-semibold">{value}</p>
            </Card>
          ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Incidents over time"
          description="Daily correlated incidents · last 7 days"
          area
          data={data.daily.map((d) => ({ name: d.name, value: d.incidents }))}
        />
        <ChartCard
          title="Severity distribution"
          description="Prioritize investigations by severity"
          data={data.severity}
        />
      </div>
      <section className="my-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Live security telemetry</h2>
            <p className="mt-1 text-xs text-muted">
              The latest activity across the synthetic banking environment
            </p>
          </div>
          <Button variant="ghost" asChild>
            <Link to="/soc/events">
              Event explorer
              <ArrowRight size={15} />
            </Link>
          </Button>
        </div>
        <EventTable events={data.recent_events} />
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Detection rule activity"
          description="Actual trigger counts for enabled and disabled rules"
          data={data.rules}
        />
        <ChartCard
          title="Response actions"
          description="Recorded execution actions"
          data={data.response}
        />
        <ChartCard
          title="Top suspicious IPs"
          description="Events above informational severity"
          data={data.ips}
        />
        <ChartCard
          title="Transaction disposition"
          description="Completed, pending, blocked and frozen transactions"
          data={data.transaction_status}
        />
        <ChartCard
          title="Attack risk progression"
          description="Most recent 20 risk evaluations across customers"
          area
          data={data.risk}
        />
        <ChartCard
          title="Event ingestion"
          description="Stored event volume · last 7 days"
          area
          data={data.daily.map((d) => ({ name: d.name, value: d.events }))}
        />
      </div>
    </>
  );
}
