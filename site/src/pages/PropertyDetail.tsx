import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { ArrowLeft, Check, Copy, MapPin, MessageCircle, Phone, Share2 } from 'lucide-react';
import { ApiError, get, media, type Property } from '../lib/api';
import { inr, inrShort, telHref, waHref } from '../lib/format';
import { useApi, useCompany } from '../lib/hooks';
import { useSeo } from '../lib/seo';
import { Gallery } from '../components/Gallery';
import { LeadForm } from '../components/Forms';
import { EmiCalculator } from '../components/Emi';
import { PropertyCard, SaveButton, StatusPill } from '../components/ui';
import { VISIT_ANCHOR } from '../lib/shortlist';
import NotFound from './NotFound';

type Detail = Property & { similar: Property[] };

function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = location.href;
    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button type="button" onClick={share} className="site-btn site-btn-ghost !py-2 text-forest" aria-live="polite">
      {copied ? <Check size={16} aria-hidden /> : typeof navigator.share === 'function' ? <Share2 size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      {copied ? 'Link copied' : 'Share'}
    </button>
  );
}

export default function PropertyDetail() {
  const { slug = '' } = useParams();
  const c = useCompany();
  const res = useApi<Detail | null>(() => get<Detail>(`/properties/${encodeURIComponent(slug)}`).catch((e) => (e instanceof ApiError && e.status === 404 ? null : Promise.reject(e))), slug);
  const [tab, setTab] = useState<'visit' | 'enquiry'>('visit');
  const p = res.data;
  const { hash } = useLocation();
  // "Book a site visit" links from the comparison page land on the form once the property has loaded.
  useEffect(() => {
    if (!p || hash !== `#${VISIT_ANCHOR}`) return;
    setTab('visit');
    document.getElementById(VISIT_ANCHOR)?.scrollIntoView({ block: 'start' });
  }, [p, hash]);
  useSeo({
    title: p ? `${p.name} · ${p.project} · Starwiz Realty` : 'Property · Starwiz Realty',
    description: p ? `${p.type} in ${p.location}, ${p.city}: ${p.area_sqft.toLocaleString('en-IN')} sq ft for ${inrShort(p.price)}. ${p.description ?? ''}`.slice(0, 300) : 'Property details',
    image: p?.cover ? media(p.cover, 'large') : undefined,
    jsonLd: p
      ? {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: p.name,
          category: p.type,
          description: p.description ?? undefined,
          image: p.images.map((i) => media(i, 'large')),
          offers: { '@type': 'Offer', price: p.price, priceCurrency: 'INR', availability: p.status === 'Available' ? 'https://schema.org/InStock' : 'https://schema.org/LimitedAvailability' },
        }
      : undefined,
  });

  if (res.data === null) return <NotFound title="Property not available" text="This property may have been sold or is no longer listed." />;
  if (!p)
    return (
      <div className="site-container py-16" aria-busy="true">
        {res.error ? <p className="text-muted">{res.error}</p> : <div className="aspect-[16/9] animate-pulse rounded-2xl bg-stone/50" />}
      </div>
    );

  const facts: [string, string | number | null | undefined][] = [
    ['Type', p.type],
    ['Project', p.project],
    ['Unit', p.unit_number],
    ['Built-up area', `${p.area_sqft.toLocaleString('en-IN')} sq ft`],
    ['Bedrooms', p.bedrooms ? `${p.bedrooms} BHK` : null],
    ['Bathrooms', p.bathrooms],
    ['Tower', p.tower],
    ['Floor', p.floor ?? null],
    ['Facing', p.facing],
    ['Furnishing', p.furnishing],
    ['Parking', p.parking ? `${p.parking} covered` : null],
    ['Possession', p.possession],
    ['Construction', p.construction_stage],
  ];
  const rera = p.rera_number || c.rera;
  const waText = `Hello ${c.name}, I am interested in ${p.name} (${p.project}, ${p.unit_number}). ${location.href}`;

  return (
    <article>
      <div className="site-container pt-8">
        <Link to="/homes" className="inline-flex items-center gap-2 text-sm font-bold text-forest hover:underline">
          <ArrowLeft size={16} aria-hidden /> All properties
        </Link>
      </div>
      <div className="site-container mt-5">
        <Gallery images={p.images} name={p.name} />
      </div>

      <div className="site-container grid gap-12 py-10 lg:grid-cols-[1fr_400px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill status={p.status} />
            <span className="text-xs font-bold uppercase tracking-wider text-brass">
              {p.type} · {p.project}
            </span>
          </div>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-forest md:text-5xl">{p.name}</h1>
          <p className="mt-3 flex items-center gap-1.5 text-muted">
            <MapPin size={16} aria-hidden /> {p.location}, {p.city}
          </p>
          <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-3">
            <p className="font-display text-4xl font-semibold text-forest">{inr(p.price)}</p>
            <p className="pb-1 text-muted">{inr(p.price / p.area_sqft)} per sq ft</p>
            <div className="ml-auto flex flex-wrap gap-2">
              <SaveButton slug={p.slug} withText />
              <ShareButton title={p.name} />
            </div>
          </div>

          <section className="mt-10" aria-labelledby="facts">
            <h2 id="facts" className="font-display text-2xl font-semibold text-forest">
              Key facts
            </h2>
            <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-black/5 bg-black/5 sm:grid-cols-3">
              {facts
                .filter(([, v]) => v !== null && v !== undefined && v !== '')
                .map(([k, v]) => (
                  <div key={k} className="bg-white p-4">
                    <dt className="text-xs font-bold uppercase tracking-wider text-muted">{k}</dt>
                    <dd className="mt-1 font-semibold">{v}</dd>
                  </div>
                ))}
            </dl>
          </section>

          {p.description && (
            <section className="mt-10" aria-labelledby="about">
              <h2 id="about" className="font-display text-2xl font-semibold text-forest">
                About this property
              </h2>
              <p className="mt-4 whitespace-pre-line text-[17px] leading-relaxed">{p.description}</p>
            </section>
          )}

          {p.amenities.length > 0 && (
            <section className="mt-10" aria-labelledby="amenities">
              <h2 id="amenities" className="font-display text-2xl font-semibold text-forest">
                Amenities
              </h2>
              <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {p.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-2">
                    <Check size={16} className="shrink-0 text-brass" aria-hidden /> {a}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-10" aria-labelledby="plan">
            <h2 id="plan" className="font-display text-2xl font-semibold text-forest">
              Payment plan
            </h2>
            <ol className="mt-5 space-y-3 text-[15px]">
              <li className="rounded-xl bg-white p-4">
                <strong>Booking.</strong> Reserve the unit with a booking amount; you get a receipt right away.
              </li>
              <li className="rounded-xl bg-white p-4">
                <strong>Instalments.</strong> The balance of {inr(p.price)} follows the schedule in your booking form
                {p.construction_stage ? `, linked to construction (currently: ${p.construction_stage})` : ''}.
              </li>
              <li className="rounded-xl bg-white p-4">
                <strong>Possession.</strong> {p.possession ? `Expected ${p.possession}.` : 'Final dues are settled before handover.'}
              </li>
            </ol>
            <p className="mt-3 text-sm text-muted">Ask our team for the exact booking amount and schedule for this unit.</p>
          </section>

          <section className="mt-10" aria-labelledby="emi">
            <h2 id="emi" className="font-display text-2xl font-semibold text-forest">
              EMI calculator
            </h2>
            <div className="mt-5">
              <EmiCalculator price={p.price} />
            </div>
          </section>

          <p className="mt-10 rounded-xl border border-black/10 p-4 text-sm text-muted">
            {rera && <span className="block font-semibold text-ink">RERA: {rera}</span>}
            Images are artist's impressions for illustration only. Actual property, finishes and surroundings may differ.
          </p>
        </div>

        <aside id={VISIT_ANCHOR} className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start" aria-label="Contact about this property">
          <div className="rounded-2xl bg-white p-6 shadow-[0_8px_30px_-12px_rgba(6,36,25,.3)]">
            <div role="tablist" aria-label="Request type" className="grid grid-cols-2 rounded-full bg-paper p-1 text-sm font-bold">
              {(['visit', 'enquiry'] as const).map((t) => (
                <button key={t} type="button" role="tab" id={`tab-${t}`} aria-selected={tab === t} aria-controls={`panel-${t}`} onClick={() => setTab(t)} className={`rounded-full py-2 ${tab === t ? 'bg-forest text-white' : 'text-forest'}`}>
                  {t === 'visit' ? 'Book a site visit' : 'Enquire'}
                </button>
              ))}
            </div>
            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-5">
              <LeadForm key={tab} kind={tab} propertySlug={p.slug} compact />
            </div>
          </div>
          {c.phone && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <a href={telHref(c.phone)} className="site-btn site-btn-ghost text-forest">
                <Phone size={17} aria-hidden /> Call
              </a>
              <a href={waHref(c.whatsapp || c.phone, waText)} target="_blank" rel="noopener" className="site-btn site-btn-ghost text-forest">
                <MessageCircle size={17} aria-hidden /> WhatsApp
              </a>
            </div>
          )}
        </aside>
      </div>

      {p.similar.length > 0 && (
        <section className="bg-white py-16" aria-labelledby="similar">
          <div className="site-container">
            <h2 id="similar" className="font-display text-3xl font-semibold text-forest">
              Similar properties
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {p.similar.map((s) => (
                <PropertyCard key={s.id} p={s} />
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
