import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { telHref, waHref } from '../lib/format';
import { useCompany } from '../lib/hooks';
import { useSeo } from '../lib/seo';
import { LeadForm } from '../components/Forms';

export default function Contact() {
  const c = useCompany();
  useSeo({ title: `Contact ${c.name}`, description: `Call, WhatsApp or write to ${c.name}. ${c.address ?? ''}` });
  return (
    <div className="site-container grid gap-12 py-14 md:grid-cols-[1fr_1.2fr] md:py-20">
      <div>
        <p className="site-eyebrow">Contact</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-forest md:text-5xl">We would love to hear from you</h1>
        <ul className="mt-8 space-y-5 text-[17px]">
          {c.phone && (
            <li className="flex gap-3">
              <Phone className="mt-0.5 shrink-0 text-brass" aria-hidden />
              <a href={telHref(c.phone)} className="font-semibold hover:underline">
                {c.phone}
              </a>
            </li>
          )}
          {c.phone && (
            <li className="flex gap-3">
              <MessageCircle className="mt-0.5 shrink-0 text-brass" aria-hidden />
              <a href={waHref(c.whatsapp || c.phone, `Hello ${c.name}`)} target="_blank" rel="noopener" className="font-semibold hover:underline">
                Chat on WhatsApp
              </a>
            </li>
          )}
          {c.email && (
            <li className="flex gap-3">
              <Mail className="mt-0.5 shrink-0 text-brass" aria-hidden />
              <a href={`mailto:${c.email}`} className="font-semibold hover:underline">
                {c.email}
              </a>
            </li>
          )}
          {c.address && (
            <li className="flex gap-3">
              <MapPin className="mt-0.5 shrink-0 text-brass" aria-hidden />
              <address className="not-italic leading-relaxed">{c.address}</address>
            </li>
          )}
        </ul>
      </div>
      <section className="rounded-2xl bg-white p-6 md:p-8" aria-labelledby="form-title">
        <h2 id="form-title" className="font-display text-2xl font-semibold text-forest">
          Send us a message
        </h2>
        <div className="mt-6">
          <LeadForm kind="enquiry" />
        </div>
      </section>
    </div>
  );
}
