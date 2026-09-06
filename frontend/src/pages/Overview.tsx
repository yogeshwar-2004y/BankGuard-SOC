import {
  ArrowDown,
  ArrowRight,
  Bot,
  Check,
  Fingerprint,
  Layers,
  Mail,
  ScanLine,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useData } from '../lib/api';
import type { Dashboard } from '../types';
import { Badge, Button, Card, Education } from '../components/ui';

const flow = [
  { title: 'Phishing', sub: 'Initial access', Icon: Mail },
  { title: 'Account takeover', sub: 'Identity compromised', Icon: Fingerprint },
  { title: 'Fraud attempt', sub: 'Funds at risk', Icon: Wallet },
  { title: 'Detection', sub: 'Signals connected', Icon: ScanLine },
  { title: 'Response', sub: 'Threat contained', Icon: ShieldCheck },
];
export default function Overview() {
  const { user } = useAuth();
  const { data } = useData<Dashboard>('/soc/dashboard', user?.role !== 'customer');
  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 md:p-10 xl:p-12">
        <div className="grid items-center gap-10 xl:grid-cols-[1.25fr_1fr]">
          <div>
            <Badge value="INTERACTIVE SECURITY OPERATIONS LAB" />
            <h1 className="mt-7 max-w-xl text-4xl font-semibold leading-[1.12] tracking-tight md:text-5xl">
              Real-world banking
              <br />
              fraud defense.
              <br />
              <span className="text-brand">End to end.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-muted">
              Follow a phishing-driven account takeover. Watch the SOC connect the evidence,
              investigate the incident and contain the fraud.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link to={user?.role === 'customer' ? '/banking' : '/simulation?guided=true'}>
                  {user?.role === 'customer' ? 'Explore your account' : 'Start Guided Simulation'}
                  <ArrowRight size={17} />
                </Link>
              </Button>
              {user?.role !== 'customer' && (
                <Button variant="secondary" asChild>
                  <Link to="/soc/dashboard">Explore SOC</Link>
                </Button>
              )}
            </div>
            <p className="mt-5 flex items-center gap-2 text-xs text-muted">
              <ShieldCheck size={14} className="text-brand" />A safe environment. Every identity and
              transaction is synthetic.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-background p-6">
            <div className="mb-6 flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-muted">
                THE DEFENSE LIFECYCLE
              </span>
              <span className="text-[10px] font-mono text-brand">01 — 05</span>
            </div>
            {flow.map((f, i) => (
              <div key={f.title}>
                <div className="flex items-center gap-4">
                  <span
                    className={`flex size-11 items-center justify-center rounded-lg border ${i === 4 ? 'border-brand/30 bg-brand/10 text-brand' : 'border-line bg-surface text-muted'}`}
                  >
                    <f.Icon size={21} />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold">{f.title}</h2>
                    <p className="mt-1 text-xs text-muted">{f.sub}</p>
                  </div>
                  <span className="ml-auto font-mono text-xs text-muted">0{i + 1}</span>
                </div>
                {i < flow.length - 1 && <ArrowDown size={15} className="my-2 ml-3.5 text-line" />}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {[
          {
            icon: Layers,
            label: 'See the signals',
            text: 'SIEM collects security events in one place. Search the data and understand why a detection triggered.',
          },
          {
            icon: ScanLine,
            label: 'Connect the evidence',
            text: 'Correlation links independent signals. Risk scoring helps analysts choose when and how to respond.',
          },
          {
            icon: Bot,
            label: 'Contain with confidence',
            text: 'SOAR runs a recorded response playbook. Verify that the account, sessions and funds were actually protected.',
          },
        ].map((item) => (
          <Card key={item.label}>
            <item.icon className="mb-5 text-brand" size={24} />
            <h2 className="font-semibold">{item.label}</h2>
            <p className="mt-3 text-sm leading-6 text-muted">{item.text}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Education
          title="What you’ll learn"
          what="Account takeover means an unauthorized person gains control of an account. This lab follows that story through phishing, authentication anomalies and attempted fraud."
          why="The important skill is separating isolated anomalies from a consistent attack pattern."
          decision="Start with guided mode, then explore the same events independently in the SOC."
        />
        <Card>
          <h2 className="mb-4 text-sm font-semibold">Your live lab, ready to explore</h2>
          {[
            'Security event monitoring',
            'Detection and risk scoring',
            'Incident investigation',
            'Automated response and reporting',
          ].map((text) => (
            <p key={text} className="mb-3 flex items-center gap-2 text-sm text-muted">
              <Check size={15} className="text-brand" />
              {text}
            </p>
          ))}
          {data && (
            <p className="mt-5 border-t border-line pt-4 text-xs text-muted">
              {data.event_count} stored events · {data.stats['ATO detections']} correlated incidents
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
