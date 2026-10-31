import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, Columns3, Heart, Trash2 } from 'lucide-react';
import { useApi } from '../lib/hooks';
import { useSeo } from '../lib/seo';
import { COMPARE_MAX, COMPARE_MIN, comparePath, getProperties, useShortlist } from '../lib/shortlist';
import { CardSkeleton, PropertyCard } from '../components/ui';

export default function Shortlist() {
  const nav = useNavigate();
  const { slugs, remove } = useShortlist();
  const res = useApi(() => getProperties(slugs), slugs.join(','));
  const [picked, setPicked] = useState<string[]>([]);
  const [pruned, setPruned] = useState(0);
  useSeo({ title: 'My shortlist · Starwiz Realty', description: 'Properties you saved on this device. Compare them side by side and book a site visit.' });

  // Properties that are no longer listed drop off the shortlist.
  const missing = res.data?.missing ?? [];
  useEffect(() => {
    if (!missing.length) return;
    setPruned((n) => n + missing.length);
    remove(...missing);
  }, [missing.join(','), remove]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the comparison selection to properties still on the list.
  useEffect(() => setPicked((cur) => cur.filter((s) => slugs.includes(s))), [slugs]);

  const list = (res.data?.found ?? []).filter((p) => slugs.includes(p.slug));
  const togglePick = (slug: string) => setPicked((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : cur.length < COMPARE_MAX ? [...cur, slug] : cur));
  const canCompare = picked.length >= COMPARE_MIN && picked.length <= COMPARE_MAX;

  return (
    <div className="site-container py-12 md:py-16">
      <p className="site-eyebrow">Saved on this device</p>
      <h1 className="mt-3 font-display text-4xl font-semibold text-forest md:text-5xl">My shortlist</h1>
      <p className="mt-3 max-w-2xl text-muted">Your shortlist stays in this browser only; nothing is sent to us until you enquire or book a visit.</p>

      {slugs.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-white p-10 text-center">
          <Heart className="mx-auto text-brass" aria-hidden />
          <p className="mt-4 font-display text-2xl font-semibold text-forest">No saved properties yet</p>
          <p className="mx-auto mt-2 max-w-md text-muted">Tap the heart on any property to keep it here, then compare up to {COMPARE_MAX} side by side.</p>
          <Link to="/homes" className="site-btn site-btn-primary mt-6">
            Browse all properties <ArrowRight size={18} aria-hidden />
          </Link>
        </div>
      ) : (
        <>
          <div className="sticky top-16 z-20 -mx-1 mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/95 p-4 shadow-sm backdrop-blur">
            <p className="text-sm text-muted" aria-live="polite">
              {picked.length === 0 ? `Select ${COMPARE_MIN} to ${COMPARE_MAX} properties to compare.` : `${picked.length} of ${COMPARE_MAX} selected for comparison.`}
            </p>
            <button type="button" className="site-btn site-btn-primary !py-2.5 disabled:opacity-40" disabled={!canCompare} onClick={() => nav(comparePath(picked))}>
              <Columns3 size={17} aria-hidden /> Compare{picked.length ? ` (${picked.length})` : ''}
            </button>
          </div>
          {pruned > 0 && (
            <p className="mt-4 text-sm text-muted" role="status">
              {pruned === 1 ? 'One saved property is' : `${pruned} saved properties are`} no longer listed and {pruned === 1 ? 'was' : 'were'} removed.
            </p>
          )}

          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {res.loading && !res.data && slugs.map((s) => <li key={s}><CardSkeleton /></li>)}
            {list.map((p) => {
              const on = picked.includes(p.slug);
              return (
                <li key={p.id} className="flex flex-col">
                  <PropertyCard p={p} />
                  <div className="mt-3 flex items-center justify-between gap-3 px-1">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-forest">
                      <input type="checkbox" className="h-4 w-4 accent-[var(--color-forest)]" checked={on} disabled={!on && picked.length >= COMPARE_MAX} onChange={() => togglePick(p.slug)} />
                      Compare <span className="sr-only">{p.name}</span>
                    </label>
                    <button type="button" onClick={() => remove(p.slug)} className="inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-forest">
                      <Trash2 size={15} aria-hidden /> Remove <span className="sr-only">{p.name}</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {res.error && <p className="mt-8 text-muted">{res.error}</p>}
        </>
      )}
    </div>
  );
}
