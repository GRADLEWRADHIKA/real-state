import { useState } from 'react';
import clsx from 'clsx';
import { MapPin, MessageCircle, MessageSquareText, Phone } from 'lucide-react';
import { CONTACT_CHANNELS, mapsHref, smsHref, telHref, waHref, type ContactChannel } from '@estateflow/shared';
import { errorMessage } from '@/lib/api';
import { useOffline } from '@/offline/OfflineProvider';
import { toast } from 'sonner';
import { Button, Field, Segmented, Sheet } from './ui';

interface PendingContact {
  channel: ContactChannel;
  at: string;
}

/**
 * Call / WhatsApp / SMS buttons. Each one opens the phone's own app through a deep link; when a lead
 * is given, a "log this contact" sheet is waiting when the person comes back.
 */
export function ContactButtons({ phone, leadId, name, className }: { phone?: string | null; leadId?: number; name: string; className?: string }) {
  const [pending, setPending] = useState<PendingContact | null>(null);
  if (!phone) return null;
  const opened = (channel: ContactChannel) => () => {
    if (leadId) setPending({ channel, at: new Date().toISOString() });
  };
  const items: { channel: ContactChannel; href?: string; icon: typeof Phone; label: string; external?: boolean }[] = [
    { channel: 'Call', href: telHref(phone), icon: Phone, label: 'Call' },
    { channel: 'WhatsApp', href: waHref(phone), icon: MessageCircle, label: 'WhatsApp', external: true },
    { channel: 'SMS', href: smsHref(phone), icon: MessageSquareText, label: 'SMS' },
  ];
  return (
    <>
      <div className={clsx('grid grid-cols-3 gap-2', className)}>
        {items.map((i) => (
          <a
            key={i.channel}
            href={i.href}
            onClick={opened(i.channel)}
            target={i.external ? '_blank' : undefined}
            rel={i.external ? 'noreferrer' : undefined}
            aria-label={`${i.label} ${name}`}
            className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-stone-200 bg-white text-[12px] font-semibold text-brand-900 active:bg-brand-50"
          >
            <i.icon className="size-5" />
            {i.label}
          </a>
        ))}
      </div>
      {leadId && pending && <LogContactSheet leadId={leadId} name={name} initial={pending} onClose={() => setPending(null)} />}
    </>
  );
}

/** Small round call button for list rows. */
export function CallChip({ phone, leadId, name }: { phone?: string | null; leadId?: number; name: string }) {
  const [pending, setPending] = useState<PendingContact | null>(null);
  if (!phone) return null;
  return (
    <>
      <a
        href={telHref(phone)}
        aria-label={`Call ${name}`}
        onClick={(e) => {
          e.stopPropagation();
          if (leadId) setPending({ channel: 'Call', at: new Date().toISOString() });
        }}
        className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-800 active:bg-brand-100"
      >
        <Phone className="size-[18px]" />
      </a>
      {leadId && pending && <LogContactSheet leadId={leadId} name={name} initial={pending} onClose={() => setPending(null)} />}
    </>
  );
}

export function MapsLink({ query, lat, lng, children }: { query: string; lat?: number | null; lng?: number | null; children?: React.ReactNode }) {
  return (
    <a href={mapsHref(query, lat, lng)} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-800">
      <MapPin className="size-4" />
      {children ?? 'Directions'}
    </a>
  );
}

/** Records a call / message against the lead with the time the person actually reached out. */
export function LogContactSheet({ leadId, name, initial, onClose }: { leadId: number; name: string; initial?: PendingContact; onClose: () => void }) {
  const { submit } = useOffline();
  const [channel, setChannel] = useState<ContactChannel>(initial?.channel ?? 'Call');
  const [summary, setSummary] = useState('');
  const [saving, setSaving] = useState(false);
  const at = initial?.at ?? new Date().toISOString();

  const save = async () => {
    setSaving(true);
    try {
      const r = await submit({ kind: 'log-contact', method: 'POST', path: `/leads/${leadId}/log-contact`, body: { channel, summary: summary.trim() || null, at }, label: `${channel} with ${name}` });
      if (r.state === 'sent') toast.success(`${channel} logged`);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={`Log ${channel.toLowerCase()} with ${name}`}>
      <Segmented value={channel} onChange={setChannel} options={CONTACT_CHANNELS.map((c) => ({ value: c, label: c }))} />
      <Field label="What happened?" hint="Optional. Saved to the lead's timeline.">
        {(id) => <textarea id={id} rows={3} className="field" placeholder="Interested in 3 BHK, wants the price sheet" value={summary} onChange={(e) => setSummary(e.target.value)} />}
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={onClose}>
          Skip
        </Button>
        <Button onClick={save} loading={saving}>
          Save
        </Button>
      </div>
    </Sheet>
  );
}
