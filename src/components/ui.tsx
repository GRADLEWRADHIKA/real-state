import { useEffect, useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import clsx from 'clsx';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, RefreshCw, X, type LucideIcon } from 'lucide-react';
import { initials } from '@estateflow/shared';
import { errorMessage, isNetworkError } from '@/lib/api';

// ─── Layout ────────────────────────────────────────────────────────────────

/** One full screen: sticky header (title, optional back + actions) over scrolling content. */
export function Screen({
  title,
  subtitle,
  back,
  actions,
  children,
  bleed = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Where "back" goes when there is no history (deep link, notification tap). */
  back?: string;
  actions?: ReactNode;
  children: ReactNode;
  bleed?: boolean;
}) {
  const navigate = useNavigate();
  const goBack = () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate(back!, { replace: true });
  };
  return (
    <div className="flex min-h-full flex-col">
      <header className="safe-top sticky top-0 z-20 border-b border-stone-200/70 bg-canvas/95 backdrop-blur">
        <div className="flex min-h-14 items-center gap-1 px-2">
          {back ? (
            <button type="button" onClick={goBack} aria-label="Back" className="grid size-11 place-items-center rounded-full text-stone-700 active:bg-stone-200/70">
              <ChevronLeft className="size-6" />
            </button>
          ) : (
            <span className="w-2" />
          )}
          <div className="min-w-0 flex-1 py-2">
            <h1 className="truncate font-display text-[21px] leading-tight font-semibold text-brand-950">{title}</h1>
            {subtitle && <p className="truncate text-[13px] text-stone-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1 pr-1">{actions}</div>}
        </div>
      </header>
      <main className={clsx('flex-1 pb-28', !bleed && 'space-y-3 px-4 pt-3')}>{children}</main>
    </div>
  );
}

export function IconButton({ icon: Icon, label, badge, className, ...rest }: { icon: LucideIcon; label: string; badge?: number } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-label={label} className={clsx('relative grid size-11 place-items-center rounded-full text-stone-700 active:bg-stone-200/70', className)} {...rest}>
      <Icon className="size-[22px]" />
      {!!badge && (
        <span className="num absolute top-1.5 right-1.5 grid min-w-[18px] place-items-center rounded-full bg-red-600 px-1 text-[10px] leading-[18px] font-bold text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

export function Section({ title, action, children, className }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('space-y-2', className)}>
      <div className="flex items-center justify-between px-1 pt-2">
        <h2 className="label-xs">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div className={clsx('card', onClick && 'active:bg-stone-50', className)} onClick={onClick}>
      {children}
    </div>
  );
}

/** Tappable list row that links somewhere. */
export function RowLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={clsx('flex items-center gap-3 px-4 py-3.5 active:bg-stone-50', className)}>
      <div className="min-w-0 flex-1">{children}</div>
      <ChevronRight className="size-4 shrink-0 text-stone-400" />
    </Link>
  );
}

export function KeyValue({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-[14px]">
      <span className="shrink-0 text-stone-500">{label}</span>
      <span className="min-w-0 text-right font-medium break-words text-ink">{children}</span>
    </div>
  );
}

export function Avatar({ name, className }: { name?: string | null; className?: string }) {
  return (
    <span className={clsx('grid size-10 shrink-0 place-items-center rounded-full bg-brand-100 text-[13px] font-bold text-brand-800', className)} aria-hidden>
      {initials(name)}
    </span>
  );
}

// ─── Controls ──────────────────────────────────────────────────────────────

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-900 text-white active:bg-brand-950 disabled:bg-stone-300',
  secondary: 'border border-stone-300 bg-white text-ink active:bg-stone-100 disabled:text-stone-400',
  ghost: 'text-brand-800 active:bg-brand-50 disabled:text-stone-400',
  danger: 'bg-red-600 text-white active:bg-red-700 disabled:bg-stone-300',
  gold: 'bg-gold-400 text-brand-950 active:bg-gold-500 disabled:bg-stone-300',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon: Icon,
  block,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: LucideIcon;
  block?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors select-none',
        size === 'sm' && 'h-9 px-3 text-[13px]',
        size === 'md' && 'h-11 px-4 text-[15px]',
        size === 'lg' && 'h-13 px-5 text-[16px]',
        block && 'w-full',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-[18px]" /> : null}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string | null; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-semibold text-stone-700">
        {label}
      </label>
      {children(id)}
      {error ? <p className="text-[12px] text-red-600">{error}</p> : hint ? <p className="text-[12px] text-stone-500">{hint}</p> : null}
    </div>
  );
}

/** Pill tabs; the value lives in the URL or state of the caller. */
export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div role="tablist" className={clsx('flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors',
            o.value === value ? 'bg-brand-900 text-white' : 'border border-stone-300 bg-white text-stone-700 active:bg-stone-100',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const TONES = {
  gray: 'bg-stone-100 text-stone-700',
  green: 'bg-brand-100 text-brand-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-sky-100 text-sky-800',
  gold: 'bg-gold-100 text-gold-600',
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = 'gray', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', TONES[tone], className)}>{children}</span>;
}

const STATUS_TONES: Record<string, Tone> = {
  New: 'blue',
  Contacted: 'gray',
  Qualified: 'green',
  'Site Visit': 'gold',
  Negotiation: 'amber',
  Booked: 'green',
  Closed: 'green',
  Lost: 'red',
  Hot: 'red',
  Warm: 'amber',
  Cold: 'blue',
  Scheduled: 'blue',
  Rescheduled: 'amber',
  Completed: 'green',
  Cancelled: 'gray',
  Pending: 'amber',
  Missed: 'red',
  Paid: 'green',
  'Partially Paid': 'amber',
  Overdue: 'red',
  Open: 'amber',
  'In Progress': 'blue',
  Resolved: 'green',
  Todo: 'gray',
  Urgent: 'red',
  High: 'amber',
  Medium: 'gray',
  Low: 'gray',
  Failed: 'red',
};
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={STATUS_TONES[status] ?? 'gray'}>{status}</Badge>;

// ─── Bottom sheet ──────────────────────────────────────────────────────────

/** Bottom sheet dialog. Closes on backdrop tap, Escape and the Android back button. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onBack = () => onClose();
    window.addEventListener('keydown', onKey);
    window.addEventListener('ef:close-sheet', onBack);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('ef:close-sheet', onBack);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" data-sheet-open>
      <div className="absolute inset-0 animate-fade bg-black/40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} className="safe-bottom relative max-h-[92vh] animate-sheet overflow-y-auto rounded-t-3xl bg-white shadow-pop">
        <div className="sticky top-0 z-10 flex items-center gap-2 bg-white px-5 pt-3 pb-2">
          <div className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-stone-300" />
          <h2 className="flex-1 pt-2 font-display text-[19px] font-semibold text-brand-950">{title}</h2>
          <IconButton icon={X} label="Close" onClick={onClose} className="-mr-2" />
        </div>
        <div className="space-y-4 px-5 pt-1 pb-6">{children}</div>
      </div>
    </div>
  );
}

// ─── States ────────────────────────────────────────────────────────────────

export function Empty({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 grid size-14 place-items-center rounded-full bg-brand-50 text-brand-700">
        <Icon className="size-7" />
      </span>
      <p className="font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-xs text-[14px] text-stone-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card divide-y divide-stone-100" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-4">
          <div className="skeleton size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-2/3" />
            <div className="skeleton h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const offline = isNetworkError(error);
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <AlertTriangle className="mb-2 size-8 text-amber-600" />
      <p className="font-semibold">{offline ? 'You are offline' : 'Could not load this'}</p>
      <p className="mt-1 text-[14px] text-stone-500">{offline ? 'This screen has not been opened on this phone yet. Connect to the internet and try again.' : errorMessage(error)}</p>
      {retry && (
        <Button variant="secondary" size="sm" icon={RefreshCw} className="mt-4" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Renders loading / error / content for a react-query result. */
export function Loadable<T>({ q, children, skeleton }: { q: { data: T | undefined; error: unknown; isPending: boolean; refetch: () => unknown }; children: (data: T) => ReactNode; skeleton?: ReactNode }) {
  if (q.data !== undefined) return <>{children(q.data)}</>;
  if (q.isPending && !q.error) return <>{skeleton ?? <ListSkeleton />}</>;
  return <ErrorState error={q.error} retry={() => void q.refetch()} />;
}

export function ViewOnlyNote() {
  return (
    <div className="rounded-xl border border-gold-200 bg-gold-50 px-4 py-3 text-[13px] text-gold-600">
      Administrators can view everything here. Make changes from the dashboard.
    </div>
  );
}
