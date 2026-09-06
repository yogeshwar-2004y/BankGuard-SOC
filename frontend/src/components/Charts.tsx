import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Datum } from '../types';
import { Card, Empty } from './ui';

export function ChartCard({
  title,
  description,
  data,
  area = false,
}: {
  title: string;
  description: string;
  data: Datum[];
  area?: boolean;
}) {
  const axis = { fill: 'var(--color-muted)', fontSize: 10 };
  const content = (
    <>
      <CartesianGrid stroke="var(--color-line)" vertical={false} />
      <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
      <YAxis tick={axis} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
      <Tooltip
        contentStyle={{
          background: 'var(--color-elevated)',
          border: '1px solid var(--color-line)',
          borderRadius: 8,
          color: 'var(--color-ink)',
        }}
      />
    </>
  );
  return (
    <Card>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mb-6 mt-1 text-xs text-muted">{description}</p>
      {data.length ? (
        <div
          className="h-56 w-full"
          role="img"
          aria-label={`${title}: ${data.map((d) => `${d.name} ${d.value}`).join(', ')}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            {area ? (
              <AreaChart data={data}>
                {content}
                <Area
                  type="monotone"
                  dataKey="value"
                  name={title}
                  stroke="var(--color-brand)"
                  fill="var(--color-brand)"
                  fillOpacity={0.09}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            ) : (
              <BarChart data={data}>
                {content}
                <Bar
                  dataKey="value"
                  name={title}
                  fill="var(--color-brand)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={38}
                  isAnimationActive={false}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : (
        <Empty />
      )}
      <details className="mt-3 text-xs text-muted">
        <summary className="py-2">View chart data</summary>
        <ul className="mt-2 space-y-2">
          {data.map((d, i) => (
            <li key={`${d.name}-${i}`} className="flex justify-between">
              <span>{d.name}</span>
              <span>{d.value}</span>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
