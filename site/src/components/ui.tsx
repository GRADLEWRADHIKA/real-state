import { Link, useNavigate } from 'react-router';
import { BedDouble, MapPin, Maximize2, Search } from 'lucide-react';
import clsx from 'clsx';
import { useState, type FormEvent } from 'react';
import { media, srcSet, type Img, type Property } from '../lib/api';
import { BUDGETS, TYPES, inrShort } from '../lib/format';

/** Responsive image (400/900/1600 widths) inside a fixed-ratio box so nothing shifts while it loads. */
export function Picture({ img, alt, sizes, ratio = '4 / 3', eager, className }: { img: Img | null; alt?: string; sizes: string; ratio?: string; eager?: boolean; className?: string }) {
  return (
    <div className={clsx('relative overflow-hidden bg-stone/60', className)} style={{ aspectRatio: ratio }}>
      {img ? (
        <img src={media(img, 'medium')} srcSet={srcSet(img)} sizes={sizes} alt={alt ?? img.alt_text} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined} decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-sm text-muted" role="img" aria-label="Image coming soon">
          Image coming soon
        </div>
      )}
    </div>
  );
}

export const ImpressionTag = ({ className }: { className?: string }) => <span className={clsx('rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur', className)}>Artist's impression</span>;

const STATUS_STYLE: Record<string, string> = {
  Available: 'bg-emerald-100 text-emerald-900',
  Reserved: 'bg-amber-100 text-amber-900',
  Booked: 'bg-stone text-ink',
  Sold: 'bg-stone text-ink',
};
export const StatusPill = ({ status }: { status: string }) => <span className={clsx('rounded-full px-2.5 py-1 text-xs font-bold', STATUS_STYLE[status] ?? 'bg-stone')}>{status}</span>;

export function PropertyCard({ p }: { p: Property }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_8px_24px_-12px_rgba(6,36,25,.25)] transition hover:-translate-y-0.5">
      <div className="relative">
        <Picture img={p.cover} sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw" className="transition duration-500 group-hover:scale-[1.02]" />
        <div className="absolute left-3 top-3">
          <StatusPill status={p.status} />
        </div>
        {p.cover?.is_ai_generated && <ImpressionTag className="absolute bottom-3 right-3" />}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-brass">
          {p.type} · {p.project}
        </p>
        <h3 className="mt-1.5 font-display text-xl font-semibold leading-snug">
          <Link to={`/homes/${encodeURIComponent(p.slug)}`} className="after:absolute after:inset-0">
            {p.name}
          </Link>
        </h3>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
          <MapPin size={14} aria-hidden /> {p.location}
          {p.city ? `, ${p.city}` : ''}
        </p>
        <div className="mt-auto flex items-end justify-between pt-5">
          <p className="font-display text-2xl font-semibold text-forest">{inrShort(p.price)}</p>
          <p className="flex gap-3 text-sm text-muted">
            {!!p.bedrooms && (
              <span className="flex items-center gap-1">
                <BedDouble size={15} aria-hidden /> {p.bedrooms} BHK
              </span>
            )}
            <span className="flex items-center gap-1">
              <Maximize2 size={14} aria-hidden /> {p.area_sqft.toLocaleString('en-IN')} sq ft
            </span>
          </p>
        </div>
      </div>
    </article>
  );
}

export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-white" aria-hidden>
      <div className="aspect-[4/3] animate-pulse bg-stone/50" />
      <div className="space-y-3 p-5">
        <div className="h-3 w-24 animate-pulse rounded bg-stone/60" />
        <div className="h-5 w-3/4 animate-pulse rounded bg-stone/60" />
        <div className="h-6 w-20 animate-pulse rounded bg-stone/60" />
      </div>
    </div>
  );
}

/** Type, budget and status search that hands off to the listings page. */
export function SearchBar({ className }: { className?: string }) {
  const nav = useNavigate();
  const [type, setType] = useState('');
  const [budget, setBudget] = useState('0');
  const [status, setStatus] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const b = BUDGETS[Number(budget)];
    const qs = new URLSearchParams();
    if (type) qs.set('type', type);
    if (status) qs.set('status', status);
    if (b.min) qs.set('min_price', String(b.min));
    if (b.max) qs.set('max_price', String(b.max));
    nav(`/homes${qs.size ? `?${qs}` : ''}`);
  };
  return (
    <form onSubmit={submit} role="search" aria-label="Search properties" className={clsx('grid gap-3 rounded-2xl bg-white p-3 text-ink shadow-xl sm:grid-cols-[1fr_1fr_1fr_auto]', className)}>
      <label className="block">
        <span className="px-1 text-xs font-bold text-muted">Property type</span>
        <select className="site-field mt-1" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="px-1 text-xs font-bold text-muted">Budget</span>
        <select className="site-field mt-1" value={budget} onChange={(e) => setBudget(e.target.value)}>
          {BUDGETS.map((b, i) => (
            <option key={b.label} value={i}>
              {b.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="px-1 text-xs font-bold text-muted">Status</span>
        <select className="site-field mt-1" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          <option>Available</option>
          <option>Reserved</option>
          <option>Booked</option>
        </select>
      </label>
      <button type="submit" className="site-btn site-btn-primary self-end !py-3">
        <Search size={18} aria-hidden /> Search
      </button>
    </form>
  );
}

export function SectionHead({ id, eyebrow, title, children }: { id?: string; eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="max-w-2xl">
      <p className="site-eyebrow">{eyebrow}</p>
      <h2 id={id} className="mt-3 font-display text-3xl font-semibold leading-tight text-forest md:text-[2.6rem]">
        {title}
      </h2>
      {children && <p className="mt-4 text-[17px] leading-relaxed text-muted">{children}</p>}
    </div>
  );
}
