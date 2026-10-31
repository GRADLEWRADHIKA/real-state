import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Check, FileText, FileUp, FolderOpen, Gift, Inbox, KeyRound, Mail, Plus, Receipt, Star, UserPlus } from 'lucide-react';
import { CONSTRUCTION_STAGES, CUSTOMER_REQUEST_TYPES, CUSTOMER_UPLOAD_TYPES, firstName, fmtDate, greeting, inr, inrShort, timeAgo, todayStr, type FeedbackItem, type PortalData, type Referral } from '@estateflow/shared';
import { ApiError, api, errorMessage } from '@/lib/api';
import { useUser } from '@/lib/session';
import { BellButton } from '@/components/shell';
import { Avatar, Badge, Button, Card, Empty, Field, KeyValue, Loadable, Screen, Section, Segmented, Sheet, StarRating, StatusBadge } from '@/components/ui';
import { ContactButtons } from '@/components/contact';
import { DocumentSections } from '@/components/files';
import { DocumentUploadSheet } from '@/components/scanner';
import { InstallmentList, RegistryBadge, TransactionList, daysLeftLabel } from './staff/Customers';
import { RequestCard } from './staff/Requests';
import { SwipeGallery } from '@/components/gallery';

export const usePortal = () => useQuery({ queryKey: ['portal'], queryFn: () => api.get<PortalData & { documents: (PortalData['documents'][number] & { mine?: boolean })[] }>('/portal') });

// ─── Home ──────────────────────────────────────────────────────────────────

function StageTrack({ stage }: { stage?: string | null }) {
  const idx = Math.max(0, CONSTRUCTION_STAGES.indexOf((stage ?? 'Booking') as (typeof CONSTRUCTION_STAGES)[number]));
  return (
    <ol className="space-y-0" aria-label="Construction progress">
      {CONSTRUCTION_STAGES.map((s, i) => (
        <li key={s} className="relative flex items-center gap-3 py-1.5" aria-current={i === idx ? 'step' : undefined}>
          {i < CONSTRUCTION_STAGES.length - 1 && <span className={clsx('absolute top-6 left-[11px] h-full w-0.5', i < idx ? 'bg-brand-600' : 'bg-stone-200')} />}
          <span className={clsx('relative grid size-6 shrink-0 place-items-center rounded-full border-2', i < idx ? 'border-brand-600 bg-brand-600 text-white' : i === idx ? 'border-gold-400 bg-gold-50' : 'border-stone-300 bg-white')}>
            {i < idx && <Check className="size-3.5" />}
            {i === idx && <span className="size-2 rounded-full bg-gold-500" />}
          </span>
          <span className={clsx('text-[14px]', i === idx ? 'font-semibold text-ink' : i < idx ? 'text-stone-600' : 'text-stone-400')}>{s}</span>
        </li>
      ))}
    </ol>
  );
}

function RegistryStatusCard({ c }: { c: PortalData['customer'] }) {
  const status = c.registry_status ?? 'Not done';
  const line =
    status === 'Done'
      ? `Done${c.registry_number ? ` – No. ${c.registry_number}` : ''}${c.registry_date ? ` · ${fmtDate(c.registry_date)}` : ''}`
      : status === 'Date fixed'
        ? `Date fixed – ${fmtDate(c.registry_date)}`
        : 'Not done yet';
  return (
    <Card className={clsx('flex items-center gap-3 p-4', status === 'Date fixed' && 'border-gold-200')}>
      <FileText className="size-5 shrink-0 text-brand-700" />
      <div className="min-w-0 flex-1">
        <p className="label-xs">Registry</p>
        <p className="mt-0.5 font-semibold">{line}</p>
        {status === 'Date fixed' && c.registry_date && <p className="text-[13px] text-stone-500">{daysLeftLabel(c.registry_date)} · Please keep your documents ready.</p>}
      </div>
      <RegistryBadge status={status} />
    </Card>
  );
}

// ─── Feedback and referrals ────────────────────────────────────────────────

type PortalFeedback = Pick<FeedbackItem, 'id' | 'kind' | 'rating' | 'comment' | 'created_at'>;
export const usePortalFeedback = () => useQuery({ queryKey: ['portal', 'feedback'], queryFn: () => api.get<{ data: PortalFeedback[] }>('/portal/feedback') });
const usePortalReferrals = () => useQuery({ queryKey: ['portal', 'referrals'], queryFn: () => api.get<{ data: Referral[] }>('/portal/referrals') });

/** Possession can be rated once the home is ready or handed over. */
const POSSESSION_STAGES = ['Ready for possession', 'Handed over'];

/** Server messages for a field come as "phone: ..."; the person only needs the sentence. */
const plainMessage = (e: unknown) => errorMessage(e).replace(/^[a-z_]+: /, '');

/** 1-5 stars and a comment: the service in general (any time) or possession (once). */
export function RateSheet({ kind, onClose }: { kind: 'general' | 'possession'; onClose: () => void }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (!rating) return setError('Tap a star to give your rating.');
    setError(null);
    setBusy(true);
    try {
      await api.post('/portal/feedback', { kind, rating, comment: comment.trim() || null });
      void qc.invalidateQueries({ queryKey: ['portal', 'feedback'] });
      toast.success('Thank you for your feedback!');
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) void qc.invalidateQueries({ queryKey: ['portal', 'feedback'] });
      setError(plainMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title={kind === 'possession' ? 'Rate your possession' : 'Rate us'}>
      <p className="text-[14px] text-stone-600">{kind === 'possession' ? 'How was getting the keys to your new home?' : 'How happy are you with our service so far?'}</p>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </p>
      )}
      <StarRating value={rating} onChange={setRating} label="Your rating" />
      <Field label="Comment" hint="Optional. Your relationship manager and the management read every comment.">
        {(id) => <textarea id={id} rows={3} className="field" value={comment} onChange={(e) => setComment(e.target.value)} />}
      </Field>
      <Button block size="lg" onClick={save} loading={busy}>
        Send rating
      </Button>
    </Sheet>
  );
}

function ReferSheet({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', phone: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  const save = async () => {
    setError(null);
    if (form.name.trim().length < 2) return setError('Enter your friend’s name.');
    if (!/^\+?[0-9 ()-]{8,16}$/.test(form.phone.trim())) return setError('Enter a valid phone number.');
    setBusy(true);
    try {
      const r = await api.post<Referral>('/portal/referrals', { name: form.name.trim(), phone: form.phone.trim(), note: form.note.trim() || null });
      qc.setQueryData<{ data: Referral[] }>(['portal', 'referrals'], (d) => (d ? { data: [r, ...d.data.filter((x) => x.id !== r.id)] } : d));
      void qc.invalidateQueries({ queryKey: ['portal', 'referrals'] });
      toast.success(`Thank you! We will call ${r.name} soon.`);
      onClose();
    } catch (e) {
      setError(plainMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title="Refer a friend">
      <p className="text-[14px] text-stone-600">Know someone looking for a home? Your relationship manager will call them and look after them as they did for you.</p>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </p>
      )}
      <Field label="Friend’s name">{(id) => <input id={id} className="field" autoComplete="off" value={form.name} onChange={set('name')} />}</Field>
      <Field label="Friend’s phone">{(id) => <input id={id} type="tel" inputMode="tel" className="field" value={form.phone} onChange={set('phone')} />}</Field>
      <Field label="Note" hint="Optional. What they are looking for, a good time to call.">
        {(id) => <input id={id} className="field" placeholder="Wants a plot, call after 6 PM" value={form.note} onChange={set('note')} />}
      </Field>
      <Button block size="lg" onClick={save} loading={busy}>
        Send referral
      </Button>
    </Sheet>
  );
}

/** What the customer sees for each referral; the internal pipeline stage stays with the sales team. */
const REFERRAL_STATUS: Record<string, string> = {
  New: 'Received',
  Contacted: 'Contacted',
  Qualified: 'In talks',
  'Site Visit': 'Visited the site',
  Negotiation: 'In talks',
  Booked: 'Booked',
  Closed: 'Booked',
  Lost: 'Not going ahead',
};

export function CustomerReferrals() {
  const q = usePortalReferrals();
  const [params, setParams] = useSearchParams();
  const adding = params.get('new') === '1';
  const setAdding = (on: boolean) => setParams(on ? { new: '1' } : {}, { replace: true });
  return (
    <Screen title="Refer a friend" back="/home">
      <Card className="flex gap-3 bg-brand-950 p-4 text-white">
        <Gift className="mt-0.5 size-6 shrink-0 text-gold-300" />
        <div>
          <p className="font-semibold">Share the home you love</p>
          <p className="mt-0.5 text-[13px] text-white/70">Refer friends and family. You can follow each referral here.</p>
        </div>
      </Card>
      <Button block icon={UserPlus} onClick={() => setAdding(true)}>
        Refer a friend
      </Button>
      <Section title="Your referrals">
        <Loadable q={q}>
          {(d) =>
            d.data.length ? (
              <Card className="divide-y divide-stone-100">
                {d.data.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={r.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{r.name}</p>
                      <p className="num text-[13px] text-stone-500">
                        {r.phone} · {timeAgo(r.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={REFERRAL_STATUS[r.status] ?? r.status} />
                  </div>
                ))}
              </Card>
            ) : (
              <Empty icon={UserPlus} title="No referrals yet" body="People you refer show up here with how things are going." />
            )
          }
        </Loadable>
      </Section>
      {adding && <ReferSheet onClose={() => setAdding(false)} />}
    </Screen>
  );
}

/** Refer and rate shortcuts on Home, plus the one-time possession prompt when the home is ready. */
function FeedbackCards({ stage }: { stage?: string | null }) {
  const fb = usePortalFeedback();
  const [rating, setRating] = useState<'general' | 'possession' | null>(null);
  const askPossession = !!stage && POSSESSION_STAGES.includes(stage) && !!fb.data && !fb.data.data.some((f) => f.kind === 'possession');
  return (
    <>
      {askPossession && (
        <Card className="flex items-center gap-3 border-gold-200 p-4">
          <KeyRound className="size-5 shrink-0 text-gold-600" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Rate your possession</p>
            <p className="text-[13px] text-stone-500">Your home is {stage === 'Handed over' ? 'handed over' : 'ready'}. Tell us how it went.</p>
          </div>
          <Button size="sm" variant="gold" onClick={() => setRating('possession')}>
            Rate
          </Button>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Link to="/refer" className="card flex h-14 items-center justify-center gap-2 font-semibold text-brand-900 active:bg-stone-50">
          <Gift className="size-[18px]" /> Refer a friend
        </Link>
        <button type="button" onClick={() => setRating('general')} className="card flex h-14 items-center justify-center gap-2 font-semibold text-brand-900 active:bg-stone-50">
          <Star className="size-[18px]" /> Rate us
        </button>
      </div>
      {rating && <RateSheet kind={rating} onClose={() => setRating(null)} />}
    </>
  );
}

export function CustomerHome() {
  const user = useUser();
  const q = usePortal();
  return (
    <Screen title={`${greeting()}, ${firstName(user.name)}`} subtitle={q.data?.company.name} actions={<BellButton />}>
      <Loadable q={q}>
        {(p) => {
          const f = p.financials;
          return (
            <>
              <div className="rounded-3xl bg-brand-950 p-5 text-white">
                <p className="text-[13px] text-white/60">Your home</p>
                <p className="mt-0.5 font-display text-[22px] leading-tight font-semibold">{p.property ? `${p.property.project} · ${p.property.unit_number}` : (p.customer.property_project ?? 'Your booking')}</p>
                {p.property && <p className="text-[14px] text-white/70">{[p.property.type, p.property.bedrooms ? `${p.property.bedrooms} BHK` : null, p.property.area_sqft ? `${p.property.area_sqft} sq ft` : null].filter(Boolean).join(' · ')}</p>}
                <div className="mt-4">
                  <div className="flex justify-between text-[12px] text-white/70">
                    <span>{inrShort(f.paid)} paid</span>
                    <span>of {inrShort(f.total_value)}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full rounded-full bg-gold-400" style={{ width: `${Math.min(100, f.progress)}%` }} />
                  </div>
                </div>
              </div>

              {f.next_installment && (
                <Link to="/payments" className={clsx('card block p-4 active:bg-stone-50', f.overdue > 0 && 'border-red-200')}>
                  <p className="label-xs">{f.overdue > 0 ? 'Overdue payment' : 'Next payment'}</p>
                  <p className="num mt-1 font-display text-[22px] font-semibold text-brand-950">{inr(f.overdue > 0 ? f.overdue : f.next_installment.balance)}</p>
                  <p className="text-[14px] text-stone-600">
                    {f.next_installment.label} · due {fmtDate(f.next_installment.due_date)}
                  </p>
                </Link>
              )}

              <RegistryStatusCard c={p.customer} />

              <FeedbackCards stage={p.property?.construction_stage} />

              {p.property && (
                <Section title="Your property">
                  <div className="-mx-4 overflow-hidden">
                    <SwipeGallery property={p.property} images={p.gallery ?? []} />
                  </div>
                  {(p.gallery ?? []).some((i) => i.is_ai_generated) && <p className="mt-2 text-[12px] text-stone-500">Artist's impressions are illustrations; the finished home may differ.</p>}
                </Section>
              )}

              {p.property && (
                <Section title="Construction">
                  <Card className="p-4">
                    <StageTrack stage={p.property.construction_stage} />
                    {p.property.possession && <p className="mt-2 text-[13px] text-stone-500">Expected possession: {p.property.possession}</p>}
                  </Card>
                </Section>
              )}

              {p.customer.agent_name && (
                <Section title="Your relationship manager">
                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={p.customer.agent_name} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{p.customer.agent_name}</p>
                        {p.customer.agent_email && (
                          <a href={`mailto:${p.customer.agent_email}`} className="inline-flex items-center gap-1 text-[13px] text-brand-800">
                            <Mail className="size-3.5" />
                            {p.customer.agent_email}
                          </a>
                        )}
                      </div>
                    </div>
                    <ContactButtons phone={p.customer.agent_phone} name={p.customer.agent_name} className="mt-3" />
                  </Card>
                </Section>
              )}

              <Card className="divide-y divide-stone-100 px-4">
                {p.deal && <KeyValue label="Booking">{p.deal.code}</KeyValue>}
                {p.deal && <KeyValue label="Stage">{p.deal.stage}</KeyValue>}
                <KeyValue label="Booked on">{fmtDate(p.customer.booking_date)}</KeyValue>
                {p.customer.nominee_name && (
                  <KeyValue label="Nominee">
                    {p.customer.nominee_name}
                    {p.customer.nominee_relation && <span className="font-normal text-stone-500"> ({p.customer.nominee_relation})</span>}
                  </KeyValue>
                )}
                {p.property?.rera_number && <KeyValue label="RERA">{p.property.rera_number}</KeyValue>}
              </Card>

              {p.property && p.property.amenities.length > 0 && (
                <Section title="Amenities">
                  <div className="flex flex-wrap gap-1.5">
                    {p.property.amenities.map((a) => (
                      <Badge key={a} tone="green">
                        {a}
                      </Badge>
                    ))}
                  </div>
                </Section>
              )}

              {p.company.phone && (
                <p className="px-1 pt-2 text-center text-[13px] text-stone-500">
                  {p.company.name} ·{' '}
                  <a href={`tel:${p.company.phone}`} className="font-semibold text-brand-800">
                    {p.company.phone}
                  </a>
                </p>
              )}
            </>
          );
        }}
      </Loadable>
    </Screen>
  );
}

// ─── Payments ──────────────────────────────────────────────────────────────

export function CustomerPayments() {
  const q = usePortal();
  const [params] = useSearchParams();
  const highlight = Number(params.get('receipt')) || undefined;
  const [tab, setTab] = useState<'schedule' | 'paid'>(highlight ? 'paid' : 'schedule');
  return (
    <Screen title="Payments" actions={<BellButton />}>
      <Loadable q={q}>
        {(p) => {
          const f = p.financials;
          return (
            <>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['Total', f.total_value, ''],
                  ['Paid', f.paid, 'text-brand-800'],
                  [f.overdue ? 'Overdue' : 'Balance', f.overdue || f.outstanding, f.overdue ? 'text-red-700' : ''],
                ].map(([label, v, cls]) => (
                  <div key={label as string} className="card px-3 py-3">
                    <p className="label-xs">{label}</p>
                    <p className={clsx('num mt-1 font-display text-[18px] font-semibold', cls as string)}>{inrShort(v as number)}</p>
                  </div>
                ))}
              </div>
              <Segmented
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'schedule', label: `Schedule · ${f.paid_installments}/${f.installments} paid` },
                  { value: 'paid', label: `Receipts · ${p.transactions.length}` },
                ]}
              />
              {tab === 'schedule' ? (
                p.installments.length ? (
                  <InstallmentList items={p.installments} />
                ) : (
                  <Empty icon={Receipt} title="No payment schedule yet" />
                )
              ) : p.transactions.length ? (
                <>
                  <TransactionList items={p.transactions} highlight={highlight} />
                  <p className="px-1 text-[13px] text-stone-500">Tap the download icon to save or share a receipt as PDF.</p>
                </>
              ) : (
                <Empty icon={Receipt} title="No payments yet" />
              )}
            </>
          );
        }}
      </Loadable>
    </Screen>
  );
}

// ─── Documents ─────────────────────────────────────────────────────────────

export function CustomerDocuments() {
  const q = usePortal();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  return (
    <Screen title="Documents" actions={<BellButton />}>
      <Button block icon={FileUp} onClick={() => setUploading(true)}>
        Upload or scan a document
      </Button>
      <Loadable q={q}>
        {(p) =>
          p.documents.length ? (
            <DocumentSections docs={p.documents.map((d) => ({ ...d, entity_type: 'customer', entity_id: p.customer.id }))} />
          ) : (
            <Empty icon={FolderOpen} title="No documents yet" body="Your agreement, receipts and KYC documents appear here." />
          )
        }
      </Loadable>
      {uploading && (
        <DocumentUploadSheet
          title="Upload or scan a document"
          types={CUSTOMER_UPLOAD_TYPES}
          send={async (form, onProgress) => {
            await api.upload('/portal/documents', form, { onProgress });
            toast.success('Your relationship manager has been told.');
          }}
          onDone={() => {
            setUploading(false);
            void qc.invalidateQueries({ queryKey: ['portal'] });
          }}
        />
      )}
    </Screen>
  );
}

// ─── Requests ──────────────────────────────────────────────────────────────

export function CustomerRequests() {
  const q = usePortal();
  const [creating, setCreating] = useState(false);
  return (
    <Screen title="Requests" actions={<BellButton />}>
      <Button block icon={Plus} onClick={() => setCreating(true)}>
        New request
      </Button>
      <Loadable q={q}>
        {(p) =>
          p.requests.length ? (
            <div className="space-y-2">
              {p.requests.map((r) => (
                <RequestCard key={r.id} r={{ ...r, customer_name: undefined, customer_phone: undefined }} />
              ))}
            </div>
          ) : (
            <Empty icon={Inbox} title="No requests yet" body="Book a site visit, ask a question or raise a concern. Your relationship manager replies here." />
          )
        }
      </Loadable>
      {creating && <NewRequestSheet onClose={() => setCreating(false)} />}
    </Screen>
  );
}

function NewRequestSheet({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState<(typeof CUSTOMER_REQUEST_TYPES)[number]>('Query');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (subject.trim().length < 3) return toast.error('Add a short subject');
    setBusy(true);
    try {
      await api.post('/portal/requests', { type, subject: subject.trim(), message: message.trim() || null, preferred_date: date || null });
      void qc.invalidateQueries({ queryKey: ['portal'] });
      toast.success('Request sent');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title="New request">
      <Segmented value={type} onChange={setType} options={CUSTOMER_REQUEST_TYPES.map((t) => ({ value: t, label: t }))} />
      <Field label="Subject">{(id) => <input id={id} className="field" value={subject} onChange={(e) => setSubject(e.target.value)} />}</Field>
      <Field label="Details" hint="Optional">
        {(id) => <textarea id={id} rows={4} className="field" value={message} onChange={(e) => setMessage(e.target.value)} />}
      </Field>
      {(type === 'Site visit' || type === 'Document') && (
        <Field label="Preferred date" hint="Optional">
          {(id) => <input id={id} type="date" className="field" min={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
      )}
      <Button block size="lg" onClick={save} loading={busy}>
        Send request
      </Button>
    </Sheet>
  );
}
