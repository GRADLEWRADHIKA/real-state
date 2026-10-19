import { Link } from 'react-router';
import { get, media, type Page, type Property } from '../lib/api';
import { useApi, useCompany } from '../lib/hooks';
import { useSeo } from '../lib/seo';
import { ImpressionTag, Picture } from '../components/ui';
import { ContactStrip } from './Home';

export default function About() {
  const c = useCompany();
  const res = useApi(() => get<Page<Property>>('/properties', { type: 'Villa', limit: 1 }), 'about');
  const img = res.data?.data[0]?.cover ?? null;
  useSeo({ title: `About ${c.name}`, description: `${c.name}: ${c.tagline ?? ''} Real estate in Lucknow.`, image: img ? media(img, 'large') : undefined });
  return (
    <>
      <section className="site-container grid gap-12 py-14 md:grid-cols-2 md:py-20">
        <div className="self-center">
          <p className="site-eyebrow">About us</p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-forest md:text-6xl">{c.tagline || 'Your Trust. Our Vision.'}</h1>
          <p className="mt-6 text-[17px] leading-relaxed text-muted">
            {c.legal_name || c.name} builds and sells villas, apartments, residential plots and commercial spaces in Lucknow. Our sales, accounts and customer teams work from one system, so the person you speak to always knows where your booking, payments and paperwork stand.
          </p>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">Every customer gets the Starwiz app with their property details, instalment schedule, receipts and documents in one place.</p>
          <Link to="/homes" className="site-btn site-btn-primary mt-8">
            See our properties
          </Link>
        </div>
        <div className="relative">
          <Picture img={img} sizes="(min-width: 768px) 50vw, 100vw" ratio="4 / 5" className="rounded-3xl" eager />
          {img && <ImpressionTag className="absolute bottom-4 left-4" />}
        </div>
      </section>
      <section className="bg-white py-16">
        <dl className="site-container grid gap-8 sm:grid-cols-3">
          <div>
            <dt className="site-eyebrow">Office</dt>
            <dd className="mt-3 leading-relaxed">{c.address}</dd>
          </div>
          <div>
            <dt className="site-eyebrow">Phone</dt>
            <dd className="mt-3">{c.phone}</dd>
          </div>
          <div>
            <dt className="site-eyebrow">Registration</dt>
            <dd className="mt-3">{c.rera ? `RERA ${c.rera}` : 'RERA details are listed on each project page.'}</dd>
          </div>
        </dl>
      </section>
      <ContactStrip />
    </>
  );
}
