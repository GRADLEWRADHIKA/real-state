import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowLeft, CalendarCheck, Check, Minus } from 'lucide-react';
import type { Property } from '../lib/api';
import { inr } from '../lib/format';
import { useApi } from '../lib/hooks';
import { useSeo } from '../lib/seo';
import { COMPARE_MAX, COMPARE_MIN, getProperties, visitPath } from '../lib/shortlist';
import { Picture, SaveButton, StatusPill } from '../components/ui';

type Row = { label: string; cell: (p: Property) => ReactNode };

const dash = <span className="text-muted">—</span>;
const text = (v: string | number | null | undefined) => (v === null || v === undefined || v === '' ? dash : v);
const Mark = ({ children }: { children: ReactNode }) => <span className="mt-1 inline-block rounded-full bg-brass/15 px-2 py-0.5 text-[11px] font-bold text-forest">{children}</span>;

export default function Compare() {
  const [params] = useSearchParams();
  const slugs = [...new Set((params.get('slugs') ?? '').split(',').map((s) => s.trim()).filter(Boolean))].slice(0, COMPARE_MAX);
  const res = useApi(() => getProperties(slugs), slugs.join(','));
  const list = res.data?.found ?? [];
  useSeo({
    title: list.length ? `Compare ${list.map((p) => p.name).join(' vs ')} · Starwiz Realty` : 'Compare properties · Starwiz Realty',
    description: 'Side-by-side comparison of Starwiz Realty properties: price, area, rate per sq ft, status, possession and amenities.',
  });

  const minPrice = Math.min(...list.map((p) => p.price));
  const maxArea = Math.max(...list.map((p) => p.area_sqft));
  const marks = list.length > 1;
  const amenities = [...new Set(list.flatMap((p) => p.amenities))].sort((a, b) => a.localeCompare(b));

  const rows: Row[] = [
    { label: 'Project', cell: (p) => text(p.project) },
    { label: 'Type', cell: (p) => text(p.type) },
    { label: 'Block', cell: (p) => text(p.block || p.tower) },
    { label: 'Unit', cell: (p) => text(p.unit_number) },
    {
      label: 'Area',
      cell: (p) => (
        <>
          {p.area_sqft.toLocaleString('en-IN')} sq ft
          {marks && p.area_sqft === maxArea && (
            <>
              <br />
              <Mark>Largest area</Mark>
            </>
          )}
        </>
      ),
    },
    {
      label: 'Price',
      cell: (p) => (
        <>
          <span className="font-display text-lg font-semibold text-forest">{inr(p.price)}</span>
          {marks && p.price === minPrice && (
            <>
              <br />
              <Mark>Lowest price</Mark>
            </>
          )}
        </>
      ),
    },
    { label: 'Rate per sq ft', cell: (p) => (p.rate_per_sqft ? inr(p.rate_per_sqft) : p.area_sqft > 0 ? inr(p.price / p.area_sqft) : dash) },
    { label: 'Facing', cell: (p) => text(p.facing) },
    { label: 'Status', cell: (p) => <StatusPill status={p.status} /> },
    { label: 'Possession', cell: (p) => text(p.possession) },
    { label: 'Construction stage', cell: (p) => text(p.construction_stage) },
  ];

  const rowHead = 'sticky left-0 z-10 w-32 min-w-32 border-r border-black/5 bg-white px-4 py-3 text-left align-top text-xs font-bold uppercase tracking-wider text-muted md:w-48 md:min-w-48';
  const cellCls = 'min-w-52 px-4 py-3 align-top text-[15px]';

  return (
    <div className="site-container py-12 md:py-16">
      <Link to="/homes/shortlist" className="inline-flex items-center gap-2 text-sm font-bold text-forest hover:underline">
        <ArrowLeft size={16} aria-hidden /> My shortlist
      </Link>
      <p className="site-eyebrow mt-6">Side by side</p>
      <h1 className="mt-3 font-display text-4xl font-semibold text-forest md:text-5xl">Compare properties</h1>

      {slugs.length < COMPARE_MIN ? (
        <div className="mt-10 rounded-2xl bg-white p-10 text-center">
          <p className="text-muted">
            Choose {COMPARE_MIN} to {COMPARE_MAX} properties from your shortlist to compare them.
          </p>
          <Link to="/homes/shortlist" className="site-btn site-btn-primary mt-6">
            Go to my shortlist
          </Link>
        </div>
      ) : res.error ? (
        <p className="mt-8 text-muted">{res.error}</p>
      ) : !res.data ? (
        <div className="mt-10 h-96 animate-pulse rounded-2xl bg-stone/50" aria-busy="true" />
      ) : (
        <>
          {res.data.missing.length > 0 && (
            <p className="mt-6 text-sm text-muted" role="status">
              {res.data.missing.length === 1 ? 'One property in this link is' : `${res.data.missing.length} properties in this link are`} no longer listed.
            </p>
          )}
          {list.length === 0 ? (
            <p className="mt-8 rounded-2xl bg-white p-8 text-center text-muted">
              None of these properties are listed any more.{' '}
              <Link to="/homes" className="font-bold text-forest underline">
                See all properties
              </Link>
            </p>
          ) : (
            <div className="mt-8 overflow-x-auto rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_8px_24px_-12px_rgba(6,36,25,.25)]" role="region" aria-label="Comparison table" tabIndex={0}>
              <table className="w-full border-separate border-spacing-0">
                <caption className="sr-only">Comparison of {list.map((p) => p.name).join(', ')}</caption>
                <thead>
                  <tr>
                    <td className={rowHead} />
                    {list.map((p) => (
                      <th key={p.id} scope="col" className={`${cellCls} text-left font-normal`}>
                        <div className="relative">
                          <Picture img={p.cover} sizes="260px" className="rounded-xl" />
                          <SaveButton slug={p.slug} className="absolute right-2 top-2" />
                        </div>
                        <Link to={`/homes/${encodeURIComponent(p.slug)}`} className="mt-3 block font-display text-xl font-semibold leading-snug text-forest hover:underline">
                          {p.name}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="[&>tr:nth-child(odd)>*]:bg-paper">
                  {rows.map((r) => (
                    <tr key={r.label}>
                      <th scope="row" className={rowHead}>
                        {r.label}
                      </th>
                      {list.map((p) => (
                        <td key={p.id} className={cellCls}>
                          {r.cell(p)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {amenities.length > 0 && (
                    <tr>
                      <th scope="colgroup" colSpan={list.length + 1} className="!bg-white px-4 pb-2 pt-6 text-left font-display text-lg font-semibold text-forest">
                        <span className="sticky left-4">Amenities</span>
                      </th>
                    </tr>
                  )}
                  {amenities.map((a) => (
                    <tr key={`a-${a}`}>
                      <th scope="row" className={`${rowHead} !normal-case !tracking-normal !text-[14px] !font-semibold !text-ink`}>
                        {a}
                      </th>
                      {list.map((p) => (
                        <td key={p.id} className={cellCls}>
                          {p.amenities.includes(a) ? (
                            <>
                              <Check size={18} className="text-brass" aria-hidden />
                              <span className="sr-only">Yes</span>
                            </>
                          ) : (
                            <>
                              <Minus size={18} className="text-black/20" aria-hidden />
                              <span className="sr-only">No</span>
                            </>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className={`${rowHead} border-t`} />
                    {list.map((p) => (
                      <td key={p.id} className={`${cellCls} border-t border-black/5 py-5`}>
                        <div className="flex flex-col gap-2">
                          <Link to={`/homes/${encodeURIComponent(p.slug)}`} className="site-btn site-btn-ghost !py-2 text-forest">
                            View <span className="sr-only">{p.name}</span>
                          </Link>
                          <Link to={visitPath(p.slug)} className="site-btn site-btn-primary !py-2">
                            <CalendarCheck size={16} aria-hidden /> Book a site visit <span className="sr-only">for {p.name}</span>
                          </Link>
                        </div>
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="mt-4 text-sm text-muted">Share this comparison by copying the page address. Prices and availability can change; please confirm with our team.</p>
        </>
      )}
    </div>
  );
}
