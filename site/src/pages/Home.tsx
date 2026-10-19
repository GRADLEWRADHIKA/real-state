import { Link } from 'react-router';
import { ArrowRight, CalendarCheck, FileSignature, Home as HomeIcon, KeyRound, MessageCircle, MessagesSquare, Phone, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { get, media, srcSet, type Page, type Property } from '../lib/api';
import { telHref, waHref } from '../lib/format';
import { useApi, useCompany } from '../lib/hooks';
import { useSeo } from '../lib/seo';
import { CardSkeleton, ImpressionTag, PropertyCard, SearchBar, SectionHead } from '../components/ui';

const STEPS = [
  { icon: MessagesSquare, title: 'Enquiry', text: 'Tell us what you are looking for. A sales advisor calls you back with options that fit your budget.' },
  { icon: CalendarCheck, title: 'Site visit', text: 'Walk the project with us at a time that suits you. We arrange pick-up on request.' },
  { icon: Wallet, title: 'Booking', text: 'Reserve your unit with the booking amount and receive a receipt straight away.' },
  { icon: FileSignature, title: 'Agreement', text: 'Sign the agreement with a clear payment schedule. Every instalment is tracked and receipted.' },
  { icon: KeyRound, title: 'Possession', text: 'Follow construction progress in the customer app until handover of your keys.' },
];

const WHY = [
  { icon: ShieldCheck, title: 'Paperwork you can check', text: 'Registration details, agreements and receipts are shared with you, and stay available in your customer app.' },
  { icon: Wallet, title: 'Clear pricing', text: 'The price you see is the price we discuss. Instalments and dues are always visible to you.' },
  { icon: HomeIcon, title: 'Homes for every stage', text: 'Villas, apartments, plots and commercial spaces across our Lucknow projects.' },
];

const FAQ = [
  { q: 'Are the pictures on this site photographs?', a: "No. The images are artist's impressions that show the planned layout and character of each property. Visit the site with us to see the real thing." },
  { q: 'How do I book a site visit?', a: 'Use the "Book a site visit" form on any property, or call or WhatsApp us. We confirm the time by phone.' },
  { q: 'Can I pay in instalments?', a: 'Yes. After booking, your agreement sets out an instalment schedule. You can see every due date and payment in the customer app.' },
  { q: 'Do you help with home loans?', a: 'Our team can share the documents banks usually ask for. The loan itself, its rate and eligibility are decided by your bank.' },
  { q: 'Which documents do I need to book?', a: 'Usually identity proof (Aadhaar or another government ID), PAN and the booking amount. Our team confirms the exact list for your property.' },
];

export default function Home() {
  const c = useCompany();
  const featured = useApi(() => get<Page<Property>>('/properties', { featured: '1', limit: 6 }), 'featured');
  const list = featured.data?.data ?? [];
  const hero = list.find((p) => p.cover)?.cover ?? null;
  useSeo({
    title: `${c.name} · Villas, apartments and plots in Lucknow`,
    description: `${c.tagline ?? ''} Browse villas, apartments, plots and commercial spaces by ${c.name}, book a site visit and talk to our team.`.trim(),
    image: hero ? media(hero, 'large') : undefined,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'RealEstateAgent',
      name: c.name,
      slogan: c.tagline,
      telephone: c.phone,
      email: c.email,
      address: c.address,
      url: location.origin,
    },
  });

  return (
    <>
      <section className="relative isolate overflow-hidden bg-forest text-white">
        {hero && <img src={media(hero, 'large')} srcSet={srcSet(hero)} sizes="100vw" alt={hero.alt_text} fetchPriority="high" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-60" />}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-forest via-forest/55 to-forest/20" />
        <div className="site-container flex min-h-[78svh] flex-col justify-end pb-10 pt-28 md:min-h-[640px] md:pb-14">
          <p className="site-eyebrow !text-brass-light">{c.tagline}</p>
          <h1 className="mt-4 max-w-3xl font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tight md:text-7xl">Homes made for the way Lucknow lives.</h1>
          <p className="mt-5 max-w-xl text-lg text-white/80">Villas, apartments, plots and commercial spaces, with a team that stays with you from first call to handover.</p>
          <SearchBar className="mt-9 max-w-4xl" />
          {hero && <ImpressionTag className="mt-4 self-start" />}
        </div>
      </section>

      <section className="site-container py-20" aria-labelledby="featured">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHead id="featured" eyebrow="Now selling" title="Featured properties" />
          <Link to="/homes" className="inline-flex items-center gap-2 font-bold text-forest hover:text-forest-3">
            View all properties <ArrowRight size={18} aria-hidden />
          </Link>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.loading && !list.length && Array.from({ length: 3 }, (_, i) => <CardSkeleton key={i} />)}
          {list.map((p) => (
            <PropertyCard key={p.id} p={p} />
          ))}
        </div>
        {featured.error && <p className="mt-6 text-muted">{featured.error}</p>}
      </section>

      <section className="bg-white py-20" aria-labelledby="why">
        <div className="site-container grid gap-12 md:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="site-eyebrow">Why Starwiz</p>
            <h2 id="why" className="mt-3 font-display text-4xl font-semibold leading-tight text-forest md:text-5xl">
              {c.tagline || 'Your Trust. Our Vision.'}
            </h2>
          </div>
          <ul className="grid gap-8 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
            {WHY.map((w) => (
              <li key={w.title}>
                <w.icon className="text-brass" aria-hidden />
                <h3 className="mt-3 text-lg font-bold">{w.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{w.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="site-container py-20" aria-labelledby="how">
        <SectionHead id="how" eyebrow="Step by step" title="How buying works">
          Five steps, one team. You always know what happens next.
        </SectionHead>
        <ol className="mt-12 grid gap-4 md:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-2xl border border-black/5 bg-white p-6">
              <span className="font-display text-sm font-semibold text-brass">0{i + 1}</span>
              <s.icon className="mt-3 text-forest" aria-hidden />
              <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {c.testimonials.length > 0 && (
        <section className="bg-forest py-20 text-white" aria-labelledby="voices">
          <div className="site-container">
            <p className="site-eyebrow">In their words</p>
            <h2 id="voices" className="mt-3 font-display text-4xl font-semibold">
              From our home owners
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {c.testimonials.slice(0, 3).map((t) => (
                <figure key={t.name} className="rounded-2xl bg-white/5 p-6">
                  <blockquote className="font-display text-lg leading-relaxed">“{t.quote}”</blockquote>
                  <figcaption className="mt-4 text-sm text-white/70">
                    {t.name}
                    {t.place ? `, ${t.place}` : ''}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="site-container grid gap-10 py-20 md:grid-cols-[1fr_1.5fr]" aria-labelledby="faq">
        <div>
          <p className="site-eyebrow">Questions</p>
          <h2 id="faq" className="mt-3 font-display text-4xl font-semibold text-forest">
            Frequently asked
          </h2>
        </div>
        <div className="divide-y divide-black/10 rounded-2xl bg-white px-6">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-bold">
                {f.q}
                <Sparkles size={16} className="shrink-0 text-brass transition group-open:rotate-45" aria-hidden />
              </summary>
              <p className="mt-3 leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <ContactStrip />
    </>
  );
}

export function ContactStrip() {
  const c = useCompany();
  return (
    <section className="bg-brass/15" aria-label="Contact">
      <div className="site-container flex flex-col items-start justify-between gap-6 py-12 md:flex-row md:items-center">
        <div>
          <p className="font-display text-3xl font-semibold text-forest">Talk to a Starwiz advisor</p>
          {c.address && <p className="mt-2 max-w-xl text-muted">{c.address}</p>}
        </div>
        <div className="flex flex-wrap gap-3">
          {c.phone && (
            <a href={telHref(c.phone)} className="site-btn site-btn-primary">
              <Phone size={18} aria-hidden /> Call {c.phone}
            </a>
          )}
          {c.phone && (
            <a href={waHref(c.whatsapp || c.phone, `Hello ${c.name}, I would like to know more.`)} target="_blank" rel="noopener" className="site-btn site-btn-ghost text-forest">
              <MessageCircle size={18} aria-hidden /> WhatsApp
            </a>
          )}
          <Link to="/contact" className="site-btn site-btn-ghost text-forest">
            Send a message
          </Link>
        </div>
      </div>
    </section>
  );
}
