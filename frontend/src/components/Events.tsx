import { useState } from 'react';
import { Activity, ChevronRight } from 'lucide-react';
import type { SecurityEvent } from '../types';
import { date, human } from '../lib/api';
import { Badge, Button, Cell, Education, Empty, JsonView, Modal, Table } from './ui';

export function EventInspector({
  event,
  close,
}: {
  event: SecurityEvent | null;
  close: () => void;
}) {
  const security =
    event?.source === 'soar'
      ? 'This event records a response action. Check the response ledger and affected account to confirm its result.'
      : 'Correlate this event with the same customer’s recent authentication and transfer activity. One anomaly alone is not proof of account takeover.';
  return (
    <Modal
      open={!!event}
      onOpenChange={(value) => {
        if (!value) close();
      }}
      title={event ? human(event.event_type) : 'Event'}
      description={event ? date(event.timestamp) : ''}
    >
      {event && (
        <div className="space-y-5">
          <Badge value={event.severity} />
          <Education
            title="What happened?"
            what={`${human(event.event_type)} was recorded by ${event.source} for ${event.location.city || 'an unknown city'}, ${event.location.country || 'unknown country'}.`}
            why={security}
            decision="Inspect the structured evidence below, then review linked incident risk factors and response actions."
          />
          <JsonView data={event} />
        </div>
      )}
    </Modal>
  );
}
export function EventTable({ events }: { events: SecurityEvent[] }) {
  const [selected, setSelected] = useState<SecurityEvent | null>(null);
  return (
    <>
      {events.length ? (
        <Table headings={['Timestamp', 'Event', 'Severity', 'Source IP', 'Location', 'Inspect']}>
          {events.map((e) => (
            <tr key={e.id} className="hover:bg-elevated/50">
              <Cell mono>{date(e.timestamp)}</Cell>
              <Cell>
                <span className="font-medium">{human(e.event_type)}</span>
                <p className="mt-1 text-xs text-muted">{e.source}</p>
              </Cell>
              <Cell>
                <Badge value={e.severity} />
              </Cell>
              <Cell mono>{e.source_ip}</Cell>
              <Cell>{e.location.city}</Cell>
              <Cell>
                <Button
                  variant="ghost"
                  aria-label={`Inspect ${human(e.event_type)}`}
                  onClick={() => setSelected(e)}
                >
                  <ChevronRight size={17} />
                </Button>
              </Cell>
            </tr>
          ))}
        </Table>
      ) : (
        <Empty />
      )}
      <EventInspector event={selected} close={() => setSelected(null)} />
    </>
  );
}
export function EventTimeline({ events }: { events: SecurityEvent[] }) {
  const [selected, setSelected] = useState<SecurityEvent | null>(null);
  return (
    <>
      <ol className="space-y-0">
        {events.map((event, index) => (
          <li key={event.id} className="relative flex gap-4 pb-7">
            {index < events.length - 1 && (
              <div className="absolute bottom-0 left-[17px] top-9 w-px bg-line" />
            )}
            <span className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-elevated text-brand">
              <Activity size={15} />
            </span>
            <button
              className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-background p-4 text-left hover:border-brand/40"
              onClick={() => setSelected(event)}
            >
              <div>
                <p className="text-sm font-medium">{human(event.event_type)}</p>
                <p className="mt-1 text-xs text-muted">
                  {date(event.timestamp)} · {event.source_ip}
                </p>
              </div>
              <Badge value={event.severity} />
            </button>
          </li>
        ))}
      </ol>
      <EventInspector event={selected} close={() => setSelected(null)} />
    </>
  );
}
