import { useSearchParams } from 'react-router';
import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { get, type Page, type Property } from '../lib/api';
import { BUDGETS, TYPES } from '../lib/format';
import { useApi } from '../lib/hooks';
import { useSeo } from '../lib/seo';
import { CardSkeleton, PropertyCard } from '../components/ui';

const KEYS = ['type', 'status', 'min_price', 'max_price', 'bedrooms', 'q', 'sort', 'order', 'page'] as const;

export default function Properties() {
  const [params, setParams] = useSearchParams();
  const query = Object.fromEntries(KEYS.map((k) => [k, params.get(k) ?? undefined]));
  const page = Number(params.get('page') ?? 1);
  const res = useApi(() => get<Page<Property>>('/properties', { ...query, limit: 12 }), params.toString());
  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k);
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };
  const budgetIndex = Math.max(
    0,
    BUDGETS.findIndex((b) => String(b.min ?? '') === (params.get('min_price') ?? '') && String(b.max ?? '') === (params.get('max_price') ?? '')),
  );
  const type = params.get('type');
  useSeo({
    title: `${type ? `${type}s` : 'Properties'} for sale · Starwiz Realty`,
    description: `Browse ${type ? `${type.toLowerCase()}s` : 'villas, apartments, plots and commercial spaces'} by Starwiz Realty in Lucknow with prices, sizes and availability.`,
  });
  const meta = res.data?.meta;

  return (
    <div className="site-container py-12 md:py-16">
      <p className="site-eyebrow">Listings</p>
      <h1 className="mt-3 font-display text-4xl font-semibold text-forest md:text-5xl">{type ? `${type}s` : 'All properties'}</h1>

      <form role="search" aria-label="Filter properties" onSubmit={(e) => e.preventDefault()} className="mt-8 grid grid-cols-2 gap-3 rounded-2xl bg-white p-4 md:grid-cols-6">
        <label className="col-span-2">
          <span className="text-xs font-bold text-muted">Search</span>
          <input
            className="site-field mt-1"
            type="search"
            placeholder="Project, area or type"
            defaultValue={params.get('q') ?? ''}
            onKeyDown={(e) => e.key === 'Enter' && set({ q: e.currentTarget.value.trim() || undefined })}
            onBlur={(e) => e.currentTarget.value.trim() !== (params.get('q') ?? '') && set({ q: e.currentTarget.value.trim() || undefined })}
          />
        </label>
        <label>
          <span className="text-xs font-bold text-muted">Type</span>
          <select className="site-field mt-1" value={type ?? ''} onChange={(e) => set({ type: e.target.value || undefined })}>
            <option value="">All</option>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs font-bold text-muted">Budget</span>
          <select
            className="site-field mt-1"
            value={budgetIndex}
            onChange={(e) => {
              const b = BUDGETS[Number(e.target.value)];
              set({ min_price: b.min?.toString(), max_price: b.max?.toString() });
            }}
          >
            {BUDGETS.map((b, i) => (
              <option key={b.label} value={i}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs font-bold text-muted">Status</span>
          <select className="site-field mt-1" value={params.get('status') ?? ''} onChange={(e) => set({ status: e.target.value || undefined })}>
            <option value="">Any</option>
            <option>Available</option>
            <option>Reserved</option>
            <option>Booked</option>
          </select>
        </label>
        <label>
          <span className="text-xs font-bold text-muted">Sort</span>
          <select
            className="site-field mt-1"
            value={params.get('sort') ? `${params.get('sort')}:${params.get('order') ?? 'asc'}` : ''}
            onChange={(e) => {
              const [sort, order] = e.target.value.split(':');
              set({ sort: sort || undefined, order: order || undefined });
            }}
          >
            <option value="">Recommended</option>
            <option value="price:asc">Price: low to high</option>
            <option value="price:desc">Price: high to low</option>
            <option value="area:desc">Largest first</option>
            <option value="newest:desc">Newest</option>
          </select>
        </label>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm text-muted" aria-live="polite">
        <span className="flex items-center gap-2">
          <SlidersHorizontal size={15} aria-hidden />
          {meta ? `${meta.total} ${meta.total === 1 ? 'property' : 'properties'}` : 'Loading…'}
        </span>
        {params.size > 0 && (
          <button type="button" className="font-bold text-forest underline-offset-4 hover:underline" onClick={() => setParams(new URLSearchParams())}>
            Clear filters
          </button>
        )}
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {res.loading && !res.data && Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />)}
        {res.data?.data.map((p) => (
          <PropertyCard key={p.id} p={p} />
        ))}
      </div>
      {res.error && <p className="mt-8 text-muted">{res.error}</p>}
      {meta && meta.total === 0 && <p className="mt-8 rounded-2xl bg-white p-8 text-center text-muted">No properties match these filters yet. Try a wider budget or another type.</p>}

      {meta && meta.pages > 1 && (
        <nav aria-label="Pages" className="mt-12 flex items-center justify-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })} className="site-btn site-btn-ghost !px-3 text-forest disabled:opacity-40" aria-label="Previous page">
            <ChevronLeft size={18} />
          </button>
          {Array.from({ length: meta.pages }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" onClick={() => set({ page: String(n) })} aria-current={n === page ? 'page' : undefined} className={`h-10 min-w-10 rounded-full px-3 font-bold ${n === page ? 'bg-forest text-white' : 'text-forest hover:bg-white'}`}>
              {n}
            </button>
          ))}
          <button type="button" disabled={!meta.hasMore} onClick={() => set({ page: String(page + 1) })} className="site-btn site-btn-ghost !px-3 text-forest disabled:opacity-40" aria-label="Next page">
            <ChevronRight size={18} />
          </button>
        </nav>
      )}
    </div>
  );
}
