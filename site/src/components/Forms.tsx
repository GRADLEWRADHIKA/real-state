import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { get, post } from '../lib/api';
import { TYPES } from '../lib/format';

/** Fetches a short-lived form token when the form first renders (the server also checks time-on-form). */
function useFormToken() {
  const [token, setToken] = useState('');
  const fetched = useRef(false);
  const refresh = () =>
    get<{ token: string }>('/form-token')
      .then((r) => setToken(r.token))
      .catch(() => setToken(''));
  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    refresh();
  }, []);
  return { token, refresh };
}

type Kind = 'enquiry' | 'visit';
const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

export function LeadForm({ kind, propertySlug, propertyName, compact }: { kind: Kind; propertySlug?: string; propertyName?: string; compact?: boolean }) {
  const { token, refresh } = useFormToken();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const id = (f: string) => `${kind}-${f}`;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    for (const k of Object.keys(data)) if (data[k] === '' && k !== 'website') delete data[k];
    setBusy(true);
    setError('');
    try {
      await post(kind === 'visit' ? '/site-visit-requests' : '/enquiries', { ...data, property_slug: propertySlug, token });
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <div role="status" className="rounded-2xl bg-emerald-50 p-6 text-emerald-950">
        <CheckCircle2 className="text-emerald-700" aria-hidden />
        <p className="mt-3 font-display text-xl font-semibold">Thank you, we have your request.</p>
        <p className="mt-1 text-[15px]">{kind === 'visit' ? 'Our team will call you to confirm the visit time.' : 'Someone from our sales team will call you shortly.'}</p>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-3.5" noValidate={false}>
      {propertyName && <p className="text-sm text-muted">About: {propertyName}</p>}
      <div className={compact ? 'space-y-3.5' : 'grid gap-3.5 sm:grid-cols-2'}>
        <div>
          <label htmlFor={id('name')} className="text-sm font-semibold">
            Your name
          </label>
          <input id={id('name')} name="name" required minLength={2} maxLength={80} autoComplete="name" className="site-field mt-1" />
        </div>
        <div>
          <label htmlFor={id('phone')} className="text-sm font-semibold">
            Mobile number
          </label>
          <input id={id('phone')} name="phone" required type="tel" inputMode="tel" minLength={8} maxLength={16} autoComplete="tel" className="site-field mt-1" />
        </div>
        <div>
          <label htmlFor={id('email')} className="text-sm font-semibold">
            Email <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id={id('email')} name="email" type="email" autoComplete="email" className="site-field mt-1" />
        </div>
        {kind === 'visit' ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={id('date')} className="text-sm font-semibold">
                Preferred date
              </label>
              <input id={id('date')} name="preferred_date" type="date" required min={tomorrow()} defaultValue={tomorrow()} className="site-field mt-1" />
            </div>
            <div>
              <label htmlFor={id('time')} className="text-sm font-semibold">
                Time
              </label>
              <select id={id('time')} name="preferred_time" className="site-field mt-1">
                <option>Morning</option>
                <option>Afternoon</option>
                <option>Evening</option>
              </select>
            </div>
          </div>
        ) : (
          !propertySlug && (
            <div>
              <label htmlFor={id('type')} className="text-sm font-semibold">
                Looking for
              </label>
              <select id={id('type')} name="property_type" className="site-field mt-1">
                <option value="">Not sure yet</option>
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          )
        )}
      </div>
      <div>
        <label htmlFor={id('message')} className="text-sm font-semibold">
          Message <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea id={id('message')} name="message" rows={3} maxLength={1000} className="site-field mt-1" />
      </div>
      {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={id('website')}>Website</label>
        <input id={id('website')} name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="site-btn site-btn-primary w-full disabled:opacity-60">
        {busy && <Loader2 size={18} className="animate-spin" aria-hidden />}
        {kind === 'visit' ? 'Book a site visit' : 'Send enquiry'}
      </button>
      <p className="text-xs text-muted">We use your details only to respond to this request.</p>
    </form>
  );
}
