import type { ButtonHTMLAttributes, ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AlertCircle, ArrowLeft, ArrowRight, Info, LoaderCircle, X } from 'lucide-react';
import { human, useData } from '../lib/api';
import type { Rule } from '../types';

export const cn = (...values: ClassValue[]) => twMerge(clsx(values));
const button = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-background hover:bg-brand/85',
        secondary: 'border border-line bg-elevated text-ink hover:bg-line',
        ghost: 'text-muted hover:bg-elevated hover:text-ink',
        danger: 'border border-critical/40 bg-critical/10 text-critical hover:bg-critical/20',
      },
    },
    defaultVariants: { variant: 'primary' },
  },
);
export function Button({
  className,
  variant,
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button> & { asChild?: boolean }) {
  const Component = asChild ? Slot : 'button';
  return <Component className={cn(button({ variant }), className)} {...props} />;
}
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn('min-w-0 rounded-xl border border-line bg-surface p-5 md:p-6', className)}
    >
      {children}
    </section>
  );
}
export function PageHeader({
  eyebrow = 'BANKGUARD / SECURITY OPERATIONS',
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-[.18em] text-brand">{eyebrow}</p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>
      </div>
      {action}
    </header>
  );
}
export function Badge({ value }: { value: string }) {
  const color = ['CRITICAL', 'FAILED', 'LOCKED', 'BLOCKED'].includes(value)
    ? 'border-critical/30 bg-critical/10 text-critical'
    : ['HIGH', 'FROZEN'].includes(value)
      ? 'border-high/30 bg-high/10 text-high'
      : ['MEDIUM', 'PAUSED', 'PENDING'].includes(value)
        ? 'border-medium/30 bg-medium/10 text-medium'
        : ['SUCCESS', 'COMPLETED', 'CONTAINED', 'ACTIVE', 'HEALTHY', 'RESOLVED'].includes(value)
          ? 'border-brand/30 bg-brand/10 text-brand'
          : 'border-low/30 bg-low/10 text-low';
  return (
    <span
      className={cn(
        'inline-flex w-fit whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-semibold tracking-wide',
        color,
      )}
    >
      {value}
    </span>
  );
}
export function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-2 text-muted">
        <p className="text-xs font-medium">{label}</p>
        {icon}
      </div>
      <p className="my-3 text-3xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </Card>
  );
}
export function Loading() {
  return (
    <div role="status" className="flex min-h-52 items-center justify-center gap-3 text-muted">
      <LoaderCircle className="animate-spin" size={20} />
      Loading application data…
    </div>
  );
}
export function ErrorBox({ error }: { error: unknown }) {
  return error ? (
    <div
      role="alert"
      className="my-4 flex items-start gap-3 rounded-lg border border-critical/30 bg-critical/10 p-4 text-sm text-critical"
    >
      <AlertCircle size={18} className="shrink-0" />
      {error instanceof Error ? error.message : String(error)}
    </div>
  ) : null;
}
export function Empty({
  text = 'No records yet. Launch a simulation to generate activity.',
}: {
  text?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-line p-10 text-center text-sm text-muted">
      {text}
    </div>
  );
}
export function Education({
  title,
  what,
  why,
  decision,
}: {
  title: string;
  what: string;
  why?: string;
  decision?: string;
}) {
  return (
    <div className="rounded-xl border border-low/20 bg-low/5 p-5">
      <div className="mb-3 flex items-center gap-2 text-low">
        <Info size={18} />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-sm leading-6 text-muted">{what}</p>
      {(why || decision) && (
        <details className="mt-3 text-sm">
          <summary className="py-2 text-low">Why it matters & SOC decision</summary>
          {why && <p className="mt-3 leading-6 text-muted">{why}</p>}
          {decision && <p className="mt-3 leading-6 text-ink">{decision}</p>}
        </details>
      )}
    </div>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  children,
  description = 'Inspect details and available actions.',
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  children: ReactNode;
  description?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-line bg-surface p-6 shadow-2xl">
          <Dialog.Title className="pr-12 text-xl font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="mb-5 mt-2 text-sm text-muted">
            {description}
          </Dialog.Description>
          <Dialog.Close
            aria-label="Close dialog"
            className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-lg hover:bg-elevated"
          >
            <X size={20} />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function JsonView({ data }: { data: unknown }) {
  return (
    <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-background p-4 font-mono text-xs leading-6 text-muted">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
export function Pagination({
  page,
  total,
  limit = 25,
  setPage,
}: {
  page: number;
  total: number;
  limit?: number;
  setPage: (page: number) => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted">
      <span>
        {total} records · Page {page} of {Math.max(1, Math.ceil(total / limit))}
      </span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          <ArrowLeft size={16} />
        </Button>
        <Button
          variant="secondary"
          aria-label="Next page"
          disabled={page * limit >= total}
          onClick={() => setPage(page + 1)}
        >
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}
export function Table({ headings, children }: { headings: string[]; children: ReactNode }) {
  return (
    <div className="max-w-full overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-elevated/60 text-xs text-muted">
          <tr>
            {headings.map((h) => (
              <th key={h} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line bg-surface">{children}</tbody>
      </table>
    </div>
  );
}
export function Cell({ children, mono = false }: { children: ReactNode; mono?: boolean }) {
  return <td className={cn('px-4 py-4', mono && 'font-mono text-xs text-muted')}>{children}</td>;
}
export function Risk({
  score,
  factors = [],
}: {
  score: number;
  factors?: { key: string; name: string; points: number }[];
}) {
  const { data } = useData<Rule[]>('/soc/detections');
  const policy = data?.find((r) => r.key === 'ATO_CORRELATION')?.config;
  const critical = policy?.critical ?? 90;
  const high = policy?.high ?? 60;
  const maximum = Math.max(150, critical + 60);
  return (
    <div>
      <div className="mb-3 flex items-end justify-between">
        <span className="text-sm text-muted">Correlated risk</span>
        <span className="text-3xl font-semibold">
          {score}
          <span className="text-sm text-muted"> points</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-elevated">
        <div
          className={cn(
            'h-full rounded-full',
            score >= critical ? 'bg-critical' : score >= high ? 'bg-high' : 'bg-brand',
          )}
          style={{ width: `${Math.min(100, (score / maximum) * 100)}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted">
        <span>0</span>
        <span>{critical} · critical threshold</span>
        <span>{maximum}+</span>
      </div>
      {factors.length > 0 && (
        <div className="mt-5 space-y-3">
          {factors.map((f) => (
            <div key={f.key} className="flex justify-between gap-2 text-sm">
              <span className="text-muted">{f.name || human(f.key)}</span>
              <span className="font-mono text-high">+{f.points}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
