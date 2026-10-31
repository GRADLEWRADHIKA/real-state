import { useState } from 'react';
import { useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BedDouble, Building2, Compass, Lock, LockOpen, Ruler, Share2 } from 'lucide-react';
import { PROPERTY_TYPES, fmtDate, fmtDateShort, inr, inrShort, type Lead, type Paginated, type PriceListEntry, type Property, type User } from '@estateflow/shared';
import { api, errorMessage } from '@/lib/api';
import { useOnline } from '@/lib/network';
import { useUser } from '@/lib/session';
import { Badge, Button, Card, Empty, Field, KeyValue, Loadable, ListSkeleton, RowLink, Screen, Section, Segmented, Sheet, StatusBadge } from '@/components/ui';
import { ProgressiveImage, SwipeGallery, websiteLink, shareProperty } from '@/components/gallery';

/** Property browser for field staff: image cards, filters, and a detail page with the gallery. */
export function Properties() {
  const [type, setType] = useState<string>('all');
  const [block, setBlock] = useState<string>('all');
  const [q, setQ] = useState('');
  const query = useQuery({
    queryKey: ['properties', type, block, q],
    queryFn: () =>
      api.get<{ data: Property[]; meta?: { blocks?: string[] } }>('/properties', { type: type === 'all' ? undefined : type, block: block === 'all' ? undefined : block, q: q || undefined, limit: 100 }),
    placeholderData: (prev) => prev,
  });
  const blocks = query.data?.meta?.blocks ?? [];
  return (
    <Screen title="Properties" back="/more">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search project, unit or location" className="input" aria-label="Search properties" />
      <Segmented value={type} onChange={setType} className="overflow-x-auto" options={[{ value: 'all', label: 'All' }, ...PROPERTY_TYPES.filter((t) => t !== 'Commercial').map((t) => ({ value: t, label: t }))]} />
      {(blocks.length > 0 || block !== 'all') && (
        <Segmented value={block} onChange={setBlock} className="overflow-x-auto" options={[{ value: 'all', label: 'All blocks' }, ...blocks.map((b) => ({ value: b, label: `Block ${b}` }))]} />
      )}
      <Loadable q={query} skeleton={<ListSkeleton rows={3} />}>
        {({ data }) =>
          data.length ? (
            <div className="space-y-3">
              {data.map((p) => (
                <RowLink key={p.id} to={`/properties/${p.id}`} className="card block overflow-hidden p-0">
                  <div className="relative">
                    <ProgressiveImage img={p.cover} fallback={p} className="h-44 w-full" />
                    <span className="absolute top-2.5 left-2.5">
                      <StatusBadge status={p.status} />
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3 p-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-bold text-ink">{p.name}</p>
                      <p className="truncate text-[13px] text-stone-500">
                        {p.project}
                        {p.block ? ` · Block ${p.block}` : ''} · {p.unit_number}
                      </p>
                    </div>
                    <p className="shrink-0 font-display text-[17px] font-semibold text-brand-950">{inrShort(p.price)}</p>
                  </div>
                </RowLink>
              ))}
            </div>
          ) : (
            <Empty icon={Building2} title="No properties match" />
          )
        }
      </Loadable>
    </Screen>
  );
}

const HOLDERS = ['admin', 'manager', 'sales'];
/** Who may release a hold: the executive who placed it, a manager or an admin. */
const canRelease = (u: User, p: Property) => u.role === 'admin' || u.role === 'manager' || (u.role === 'sales' && p.hold_by === u.id);
const daysLeft = (iso: string) => Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000));
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Current price-list rate for the unit's project and block (latest entry in effect today), if one is set. */
function usePriceListRate(p: Property | undefined) {
  const q = useQuery({
    queryKey: ['price-list', p?.project],
    queryFn: () => api.get<{ data: PriceListEntry[]; meta: { current: PriceListEntry[] } }>('/price-list', { project: p!.project }),
    enabled: !!p,
    staleTime: 5 * 60_000,
  });
  return q.data?.meta.current.find((c) => c.project === p?.project && (c.block ?? '') === (p?.block ?? ''));
}

function HoldCard({ p, onChange }: { p: Property; onChange: (p: Property) => void }) {
  const user = useUser();
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [holding, setHolding] = useState(false);
  if (!HOLDERS.includes(user.role)) return null;

  const release = async () => {
    if (!online) return toast.error('Releasing a hold needs a connection.');
    setBusy(true);
    try {
      onChange(await api.post<Property>(`/properties/${p.id}/release`, {}));
      toast.success('Hold released. The unit is available again.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (p.status === 'Reserved' && p.hold_until) {
    const left = daysLeft(p.hold_until);
    return (
      <Card className="border-gold-200 bg-gold-50/60 p-4">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 size-5 shrink-0 text-gold-600" />
          <div className="min-w-0 flex-1 text-[14px]">
            <p className="font-semibold text-ink">
              On hold{p.hold_lead_name ? ` for ${p.hold_lead_name}` : ''} until {fmtDate(p.hold_until)}
            </p>
            <p className="text-stone-600">
              {left === 0 ? 'Ends today' : `${plural(left, 'day')} left`}
              {p.hold_by_name ? ` · by ${p.hold_by_name}` : ''}
            </p>
            {p.hold_note && <p className="mt-1 text-[13px] text-stone-500">{p.hold_note}</p>}
          </div>
        </div>
        {canRelease(user, p) && (
          <Button variant="secondary" size="sm" icon={LockOpen} className="mt-3" block loading={busy} onClick={() => void release()}>
            Release
          </Button>
        )}
      </Card>
    );
  }

  if (p.status !== 'Available') return null;
  return (
    <>
      <Button variant="gold" icon={Lock} block onClick={() => (online ? setHolding(true) : toast.error('Holding a unit needs a connection.'))}>
        Hold for buyer
      </Button>
      {holding && (
        <HoldSheet
          p={p}
          onClose={() => setHolding(false)}
          onDone={(np) => {
            onChange(np);
            setHolding(false);
          }}
        />
      )}
    </>
  );
}

const HOLD_DAYS = ['1', '3', '7'];

function HoldSheet({ p, onClose, onDone }: { p: Property; onClose: () => void; onDone: (p: Property) => void }) {
  const [days, setDays] = useState('3');
  const [leadId, setLeadId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const leads = useQuery({
    queryKey: ['leads', 'mine-open'],
    queryFn: () => api.get<Paginated<Lead>>('/leads', { agent: 'me', status: 'New,Contacted,Qualified,Site Visit,Negotiation', limit: 100 }),
  });
  const n = Number(days);
  const save = async () => {
    if (!Number.isInteger(n) || n < 1 || n > 15) return toast.error('Hold for 1 to 15 days');
    setBusy(true);
    try {
      const r = await api.post<Property>(`/properties/${p.id}/hold`, { days: n, lead_id: leadId ? Number(leadId) : null, note: note.trim() || null });
      toast.success(`On hold for ${plural(n, 'day')}`);
      onDone(r);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title="Hold for buyer">
      <p className="text-[14px] text-stone-600">
        {p.project} · {p.unit_number} shows as Reserved until the hold ends, then becomes available again unless it is booked.
      </p>
      <div className="space-y-1.5">
        <p className="text-[13px] font-semibold text-stone-700">Hold for</p>
        <Segmented value={days} onChange={setDays} options={HOLD_DAYS.map((d) => ({ value: d, label: plural(Number(d), 'day') }))} />
      </div>
      <Field label="Days" hint="Or type any number up to 15">
        {(id) => <input id={id} type="number" inputMode="numeric" min={1} max={15} className="field num" value={days} onChange={(e) => setDays(e.target.value)} />}
      </Field>
      <Field label="Buyer" hint="Optional. One of your open leads.">
        {(id) => (
          <select id={id} className="field" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            <option value="">No lead</option>
            {[...(leads.data?.data ?? [])]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.status})
                </option>
              ))}
          </select>
        )}
      </Field>
      <Field label="Note" hint="Optional">
        {(id) => <input id={id} className="field" placeholder="Family deciding this weekend" value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
      <Button block size="lg" loading={busy} onClick={() => void save()}>
        Hold unit
      </Button>
    </Sheet>
  );
}

export function PropertyDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const key = ['properties', 'detail', id];
  const q = useQuery({ queryKey: key, queryFn: () => api.get<Property>(`/properties/${id}`) });
  const rate = usePriceListRate(q.data);
  const changed = (p: Property) => {
    qc.setQueryData(key, p);
    void qc.invalidateQueries({ queryKey: ['properties'], predicate: (k) => k.queryKey[1] !== 'detail' });
  };
  return (
    <Screen title={q.data ? `${q.data.project} · ${q.data.unit_number}` : 'Property'} back="/properties" bleed>
      <Loadable q={q}>
        {(p) => (
          <>
            <SwipeGallery property={p} images={p.images ?? []} />
            <div className="space-y-4 px-4 pb-6">
              <div className="flex items-start justify-between gap-3 pt-1">
                <div>
                  <p className="font-display text-[22px] leading-tight font-semibold text-brand-950">{p.name}</p>
                  <p className="text-[13.5px] text-stone-500">
                    {p.location}, {p.city}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div className="flex flex-wrap gap-2 text-[13px] text-stone-600">
                <Badge className="gap-1">
                  <Ruler className="size-3.5" /> {p.area_sqft.toLocaleString('en-IN')} sq ft
                </Badge>
                {p.bedrooms ? (
                  <Badge className="gap-1">
                    <BedDouble className="size-3.5" /> {p.bedrooms} BHK
                  </Badge>
                ) : null}
                {p.facing && (
                  <Badge className="gap-1">
                    <Compass className="size-3.5" /> {p.facing}
                  </Badge>
                )}
              </div>
              <HoldCard p={p} onChange={changed} />
              <Card className="p-4">
                <KeyValue label="Price">{inr(p.price)}</KeyValue>
                {p.rate_per_sqft ? <KeyValue label="Rate">{inr(p.rate_per_sqft)} / sq ft</KeyValue> : null}
                {rate && (
                  <KeyValue label="Price list">
                    {inr(rate.rate_per_sqft)} / sq ft
                    <span className="block text-[12px] font-normal text-stone-500">
                      {rate.block ? `Block ${rate.block}, ` : ''}since {fmtDateShort(rate.effective_from)}
                    </span>
                  </KeyValue>
                )}
                {p.block && <KeyValue label="Block">{p.block}</KeyValue>}
                {p.possession && <KeyValue label="Possession">{p.possession}</KeyValue>}
                {p.rera_number && <KeyValue label="RERA">{p.rera_number}</KeyValue>}
                <KeyValue label="Website">{websiteLink(p) ? 'Published' : 'Not published'}</KeyValue>
              </Card>
              {p.description && <p className="text-[14px] leading-relaxed text-stone-600">{p.description}</p>}
              {p.amenities.length > 0 && (
                <Section title="Amenities">
                  <div className="flex flex-wrap gap-1.5">
                    {p.amenities.map((a) => (
                      <Badge key={a}>{a}</Badge>
                    ))}
                  </div>
                </Section>
              )}
              {(p.images ?? []).some((i) => i.is_ai_generated) && <p className="text-[12px] text-stone-500">Images marked "Artist's impression" are illustrations, not photographs.</p>}
              <Button variant="secondary" icon={Share2} onClick={() => shareProperty(p)} block>
                Share{websiteLink(p) ? ' link' : ''}
              </Button>
            </div>
          </>
        )}
      </Loadable>
    </Screen>
  );
}
