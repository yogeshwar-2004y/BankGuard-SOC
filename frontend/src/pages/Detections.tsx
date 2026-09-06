import { useState } from 'react';
import { FlaskConical, Settings2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Education,
  ErrorBox,
  JsonView,
  Loading,
  Modal,
  PageHeader,
} from '../components/ui';
import { api, date, queryClient, useData } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Rule } from '../types';

export default function Detections() {
  const { data, error, isPending } = useData<Rule[]>('/soc/detections');
  const { user } = useAuth();
  const [selected, setSelected] = useState<Rule | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);
  const [testResult, setTestResult] = useState<unknown>(null);
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
  return (
    <>
      <PageHeader
        title="Detection engineering"
        description="Understand the rules that turn banking telemetry into actionable security signals."
      />
      <Education
        title="Transparent, configurable logic"
        what="Rules evaluate stored events. Administrators can change weights, thresholds and time windows; no arbitrary code can be submitted."
        why="Weights are deliberately tuned for the educational full-chain scenario to reach 110 points at the transfer. Threshold defaults are 30 / 60 / 90."
        decision="Use Test rule to replay recent stored source events inside rollback-only transactions. It does not change banking state."
      />
      <ErrorBox error={error || actionError} />
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {data?.map((rule) => (
          <Card key={rule.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-mono tracking-wide text-muted">{rule.key}</p>
                <h2 className="mt-2 font-semibold">{rule.name}</h2>
              </div>
              <Badge value={rule.enabled ? 'ACTIVE' : 'DISABLED'} />
            </div>
            <p className="mt-4 min-h-12 text-sm leading-6 text-muted">{rule.description}</p>
            <div className="my-5 flex flex-wrap gap-3">
              <Badge value={rule.severity} />
              <span className="text-xs text-muted">+{rule.weight} points</span>
              <span className="text-xs text-muted">{rule.trigger_count} triggers</span>
            </div>
            <p className="text-xs text-muted">
              Last triggered: {rule.last_triggered ? date(rule.last_triggered) : 'Never'}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  void act(async () =>
                    setTestResult(await api(`/soc/detections/${rule.id}/test`, 'POST')),
                  )
                }
              >
                <FlaskConical size={15} />
                Test rule
              </Button>
              <Button variant="ghost" onClick={() => setSelected(rule)}>
                <Settings2 size={15} />
                {user?.role === 'admin' ? 'Configure' : 'View configuration'}
              </Button>
              {user?.role === 'admin' && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    void act(() =>
                      api(`/soc/detections/${rule.id}`, 'PATCH', { enabled: !rule.enabled }),
                    )
                  }
                >
                  {rule.enabled ? 'Disable' : 'Enable'}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
      <Modal
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
        title={selected?.name || 'Rule configuration'}
      >
        {selected && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const payload = Object.fromEntries(
                [...new FormData(e.currentTarget)].map(([key, value]) => [key, Number(value)]),
              );
              void act(async () => {
                await api(`/soc/detections/${selected.id}`, 'PATCH', payload);
                setSelected(null);
              });
            }}
          >
            <p className="text-sm leading-6 text-muted">{selected.description}</p>
            <label>
              Risk weight
              <input
                name="weight"
                type="number"
                min={0}
                max={100}
                defaultValue={selected.weight}
                disabled={user?.role !== 'admin'}
              />
            </label>
            {Object.entries(selected.config).map(([key, value]) => (
              <label key={key}>
                {key.replaceAll('_', ' ')}
                <input
                  name={key}
                  type="number"
                  min={1}
                  defaultValue={value}
                  disabled={user?.role !== 'admin'}
                />
              </label>
            ))}
            <ErrorBox error={actionError} />
            {user?.role === 'admin' && <Button disabled={busy}>Save configuration</Button>}
          </form>
        )}
      </Modal>
      <Modal
        open={testResult !== null}
        onOpenChange={(v) => {
          if (!v) setTestResult(null);
        }}
        title="Rule replay results"
      >
        <JsonView data={testResult} />
      </Modal>
    </>
  );
}
