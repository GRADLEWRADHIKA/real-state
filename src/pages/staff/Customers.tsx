import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Download, Loader2, Pencil, Search, UserRound } from 'lucide-react';
import {
  REGISTRY_STATUSES,
  daysBetween,
  fmtDate,
  fmtDateShort,
  inr,
  inrShort,
  timeAgo,
  todayStr,
  type Activity,
  type Customer,
  type CustomerRequest,
  type DocumentItem,
  type Financials,
  type Installment,
  type Paginated,
  type Property,
  type RegistryStatus,
  type Settings,
  type Transaction,
} from '@estateflow/shared';
import { api, errorMessage } from '@/lib/api';
import { canWrite, useUser } from '@/lib/session';
import { paymentReminderText, receiptText, registryReminderText } from '@/lib/messages';
import { BellButton } from '@/components/shell';
import { Avatar, Badge, Button, Card, Empty, Field, KeyValue, Loadable, RowLink, Screen, Segmented, Sheet, StatusBadge, type Tone } from '@/components/ui';
import { ContactButtons, CallChip, WhatsAppLink } from '@/components/contact';
import { DocumentSections, useDownload } from '@/components/files';
import { DocumentUploadSheet } from '@/components/scanner';
import { RequestCard } from './Requests';

export default function Customers() {
  const user = useUser();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'overdue'>('all');
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const query = useInfiniteQuery({
    queryKey: ['customers', 'list', q, filter],
    queryFn: ({ pageParam }) => api.get<Paginated<Customer>>('/customers', { q: q || undefined, payment: filter === 'overdue' ? 'overdue' : undefined, limit: 25, cursor: pageParam || undefined }),
    initialPageParam: '',
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  });

  return (
    <Screen title="Customers" subtitle={user.role === 'sales' ? 'Your bookings' : undefined} actions={<BellButton />}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-stone-400" />
        <input type="search" aria-label="Search customers" placeholder="Name, phone or code" className="field pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'overdue', label: 'With overdue dues' }]} />
      <Loadable q={{ ...query, data: query.data?.pages }}>
        {(pages) => {
          const rows = pages.flatMap((p) => p.data);
          if (!rows.length) return <Empty icon={UserRound} title="No customers found" />;
          return (
            <>
              <Card className="divide-y divide-stone-100">
                {rows.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <Link to={`/customers/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar name={c.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{c.name}</p>
                        <p className="truncate text-[13px] text-stone-500">
                          {c.property_project} {c.property_unit}
                        </p>
                        <p className={clsx('num text-[12px]', c.overdue > 0 ? 'font-semibold text-red-600' : 'text-stone-400')}>
                          {c.overdue > 0 ? `${inr(c.overdue)} overdue` : c.outstanding > 0 ? `${inrShort(c.outstanding)} outstanding` : 'Fully paid'}
                        </p>
                      </div>
                    </Link>
                    <CallChip phone={c.phone} name={c.name} />
                  </div>
                ))}
              </Card>
              {query.hasNextPage && (
                <Button variant="secondary" block loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
                  Load more
                </Button>
              )}
            </>
          );
        }}
      </Loadable>
    </Screen>
  );
}

interface CustomerDetailData extends Customer {
  property: Property | null;
  deal: { code: string; stage: string; booking_date: string; value: number } | null;
  installments: Installment[];
  transactions: Transaction[];
  documents: DocumentItem[];
  /** True for staff who may not open customer papers (only administrators and accounts may). */
  documents_hidden?: boolean;
  activities: Activity[];
  financials: Financials;
  requests: CustomerRequest[];
}

type Tab = 'overview' | 'payments' | 'documents' | 'requests';

/** Admin and accounts (the only staff who see customer papers) upload or scan straight into a section. */
function CustomerDocumentsTab({ c }: { c: CustomerDetailData }) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<{ title: string; types: readonly string[]; type?: string } | null>(null);
  return (
    <>
      <DocumentSections docs={c.documents} onUpload={(section, missing) => setTarget({ title: section.title, types: section.types, type: missing[0] })} />
      {target && (
        <DocumentUploadSheet
          title={`Add to ${target.title}`}
          types={target.types}
          defaultType={target.type}
          send={(form, onProgress) => {
            form.append('entity_type', 'customer');
            form.append('entity_id', String(c.id));
            return api.upload('/documents', form, { onProgress });
          }}
          onDone={() => {
            setTarget(null);
            void qc.invalidateQueries({ queryKey: ['customers', c.id] });
          }}
        />
      )}
    </>
  );
}

export function CustomerDetail() {
  const id = Number(useParams().id);
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'overview';
  const q = useQuery({ queryKey: ['customers', id], queryFn: () => api.get<CustomerDetailData>(`/customers/${id}`), enabled: Number.isFinite(id) });

  return (
    <Screen title={q.data?.name ?? 'Customer'} subtitle={q.data?.code} back="/customers">
      <Loadable q={q}>
        {(c) => (
          <>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Avatar name={c.name} className="size-12" />
                <div className="min-w-0 flex-1">
                  <p className="num font-semibold">{c.phone}</p>
                  <p className="truncate text-[13px] text-stone-500">
                    {c.property_project} {c.property_unit}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </div>
              <ContactButtons phone={c.phone} name={c.name} className="mt-4" />
            </Card>
            <Segmented
              value={tab}
              onChange={(v) => setParams(v === 'overview' ? {} : { tab: v }, { replace: true })}
              options={[
                { value: 'overview', label: 'Overview' },
                { value: 'payments', label: 'Payments' },
                ...(c.documents_hidden ? [] : [{ value: 'documents' as const, label: `Documents · ${c.documents.length}` }]),
                { value: 'requests', label: `Requests · ${c.requests.length}` },
              ]}
            />
            {tab === 'overview' && <Overview c={c} />}
            {tab === 'payments' && <PaymentsTab c={c} />}
            {tab === 'documents' &&
              <CustomerDocumentsTab c={c} />}
            {tab === 'requests' &&
              (c.requests.length ? (
                <div className="space-y-2">
                  {c.requests.map((r) => (
                    <RequestCard key={r.id} r={r} />
                  ))}
                </div>
              ) : (
                <Empty icon={UserRound} title="No requests from this customer" />
              ))}
          </>
        )}
      </Loadable>
    </Screen>
  );
}

/** Company name for message signatures, from the settings every signed-in person can read. */
function useCompanyName() {
  const q = useQuery({ queryKey: ['settings'], queryFn: () => api.get<Settings>('/settings'), staleTime: 60 * 60_000 });
  return q.data?.company?.name ?? '';
}

const REGISTRY_TONES: Record<RegistryStatus, Tone> = { 'Not done': 'gray', 'Date fixed': 'gold', Done: 'green' };
export const RegistryBadge = ({ status }: { status?: RegistryStatus | null }) => <Badge tone={REGISTRY_TONES[status ?? 'Not done'] ?? 'gray'}>{status ?? 'Not done'}</Badge>;

export function daysLeftLabel(date: string) {
  const d = daysBetween(todayStr(), date);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  return d > 0 ? `${d} days left` : `${-d} days ago`;
}

function RegistryCard({ c, company }: { c: CustomerDetailData; company: string }) {
  const user = useUser();
  const [editing, setEditing] = useState(false);
  const status = c.registry_status ?? 'Not done';
  const canEdit = canWrite(user) && (user.role === 'manager' || user.role === 'sales');
  const property = [c.property_project, c.property_unit].filter(Boolean).join(' ') || null;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="font-semibold">Registry</p>
          <RegistryBadge status={status} />
        </div>
        {canEdit && (
          <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(true)}>
            Update
          </Button>
        )}
      </div>
      {status !== 'Not done' && (c.registry_date || c.registry_number) && (
        <div className="mt-1 divide-y divide-stone-100">
          {c.registry_date && (
            <KeyValue label="Date">
              {fmtDate(c.registry_date)}
              {status === 'Date fixed' && <span className="block text-[12px] font-normal text-stone-500">{daysLeftLabel(c.registry_date)}</span>}
            </KeyValue>
          )}
          {c.registry_number && <KeyValue label="Registry no.">{c.registry_number}</KeyValue>}
        </div>
      )}
      {status === 'Date fixed' && c.registry_date && daysBetween(todayStr(), c.registry_date) >= 0 && (
        <WhatsAppLink phone={c.phone} label="Registry reminder" className="mt-2" text={registryReminderText(c.name, c.registry_date, property, company)} />
      )}
      {editing && <RegistrySheet c={c} onClose={() => setEditing(false)} />}
    </Card>
  );
}

function RegistrySheet({ c, onClose }: { c: CustomerDetailData; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<RegistryStatus>(c.registry_status ?? 'Not done');
  const [date, setDate] = useState(c.registry_date ?? '');
  const [number, setNumber] = useState(c.registry_number ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (status === 'Date fixed' && !date) return void toast.error('Choose the registry date');
    if (status === 'Done' && !number.trim()) return void toast.error('Enter the registry number');
    setBusy(true);
    try {
      await api.put(`/customers/${c.id}`, {
        registry_status: status,
        registry_date: status === 'Not done' ? null : date || null,
        registry_number: status === 'Done' ? number.trim() : null,
      });
      void qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Registry updated');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title={`Registry · ${c.name}`}>
      <Segmented value={status} onChange={setStatus} options={REGISTRY_STATUSES.map((s) => ({ value: s, label: s }))} />
      {status !== 'Not done' && (
        <Field label="Registry date" hint={status === 'Date fixed' ? 'Required. The customer is reminded before the date.' : 'Optional'}>
          {(id) => <input id={id} type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
      )}
      {status === 'Done' && (
        <Field label="Registry number" hint="Required">
          {(id) => <input id={id} className="field" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="As on the registry document" />}
        </Field>
      )}
      <Button block size="lg" onClick={save} loading={busy}>
        Save
      </Button>
    </Sheet>
  );
}

function Money({ label, value, tone }: { label: string; value: number; tone?: 'red' | 'green' }) {
  return (
    <div className="card px-3 py-3">
      <p className="label-xs">{label}</p>
      <p className={clsx('num mt-1 font-display text-[18px] font-semibold', tone === 'red' ? 'text-red-700' : tone === 'green' ? 'text-brand-800' : 'text-ink')}>{inrShort(value)}</p>
    </div>
  );
}

function Overview({ c }: { c: CustomerDetailData }) {
  const f = c.financials;
  const company = useCompanyName();
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Money label="Value" value={f.total_value} />
        <Money label="Paid" value={f.paid} tone="green" />
        <Money label={f.overdue ? 'Overdue' : 'Due'} value={f.overdue || f.outstanding} tone={f.overdue ? 'red' : undefined} />
      </div>
      <div className="card p-4">
        <div className="flex justify-between text-[13px]">
          <span className="text-stone-500">Paid so far</span>
          <span className="num font-semibold">{Math.round(f.progress)}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
          <div className="h-full rounded-full bg-brand-700" style={{ width: `${Math.min(100, f.progress)}%` }} />
        </div>
        {f.next_installment && (
          <p className="mt-3 text-[14px]">
            Next: <span className="font-semibold">{f.next_installment.label}</span> · {inr(f.next_installment.balance)} on {fmtDateShort(f.next_installment.due_date)}
          </p>
        )}
      </div>
      <RegistryCard c={c} company={company} />
      <Card className="divide-y divide-stone-100 px-4">
        <KeyValue label="Booked on">{fmtDate(c.booking_date)}</KeyValue>
        {(c.property_block || c.property?.block) && <KeyValue label="Block">{c.property_block || c.property?.block}</KeyValue>}
        {c.deal && <KeyValue label="Deal stage">{c.deal.stage}</KeyValue>}
        {c.property?.construction_stage && <KeyValue label="Construction">{c.property.construction_stage}</KeyValue>}
        {c.agent_name && <KeyValue label="Agent">{c.agent_name}</KeyValue>}
        {c.broker_name && <KeyValue label="Broker">{c.broker_name}</KeyValue>}
        {c.nominee_name && (
          <KeyValue label="Nominee">
            {c.nominee_name}
            {c.nominee_relation && <span className="font-normal text-stone-500"> ({c.nominee_relation})</span>}
            {c.nominee_phone && (
              <a href={`tel:${c.nominee_phone}`} className="num block text-[13px] text-brand-800">
                {c.nominee_phone}
              </a>
            )}
          </KeyValue>
        )}
        {c.email && <KeyValue label="Email">{c.email}</KeyValue>}
        {c.city && <KeyValue label="City">{c.city}</KeyValue>}
      </Card>
      {c.lead_id && (
        <Card>
          <RowLink to={`/leads/${c.lead_id}`}>
            <p className="font-semibold">Original lead</p>
            <p className="text-[13px] text-stone-500">Calls, visits and notes before booking</p>
          </RowLink>
        </Card>
      )}
      {c.activities.length > 0 && (
        <Card className="divide-y divide-stone-100">
          {c.activities.slice(0, 8).map((a) => (
            <div key={a.id} className="px-4 py-3">
              <p className="text-[14px] font-semibold">{a.title}</p>
              {a.description && <p className="text-[13px] text-stone-600">{a.description}</p>}
              <p className="text-[12px] text-stone-400">
                {timeAgo(a.created_at)}
                {a.user_name && ` · ${a.user_name}`}
              </p>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

export function ReceiptButton({ t }: { t: Pick<Transaction, 'id' | 'code' | 'receipt_number' | 'status'> }) {
  const { busy, run } = useDownload();
  if (t.status === 'Failed') return null;
  const key = `r-${t.id}`;
  return (
    <button
      type="button"
      aria-label={`Download receipt ${t.receipt_number ?? t.code}`}
      disabled={busy === key}
      onClick={() => void run(key, `/transactions/${t.id}/receipt.pdf`, `Receipt-${(t.receipt_number ?? t.code).replace(/\//g, '-')}.pdf`)}
      className="grid size-10 shrink-0 place-items-center rounded-full text-brand-800 active:bg-brand-50"
    >
      {busy === key ? <Loader2 className="size-5 animate-spin" /> : <Download className="size-5" />}
    </button>
  );
}

export function InstallmentList({ items, action }: { items: Installment[]; action?: (i: Installment) => ReactNode }) {
  return (
    <Card className="divide-y divide-stone-100">
      {items.map((i) => (
        <div key={i.id} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{i.label}</p>
            <p className="text-[13px] text-stone-500">Due {fmtDate(i.due_date)}</p>
          </div>
          <div className="text-right">
            <p className="num font-semibold">{inr(i.amount)}</p>
            {i.paid_amount > 0 && i.balance > 0 && <p className="num text-[12px] text-stone-500">{inr(i.balance)} left</p>}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <StatusBadge status={i.status} />
            {action?.(i)}
          </div>
        </div>
      ))}
    </Card>
  );
}

export function TransactionList({ items, highlight, action }: { items: Transaction[]; highlight?: number; action?: (t: Transaction) => ReactNode }) {
  return (
    <Card className="divide-y divide-stone-100">
      {items.map((t) => (
        <div key={t.id} className={clsx('flex items-center gap-3 px-4 py-3', highlight === t.id && 'bg-gold-50')}>
          <div className="min-w-0 flex-1">
            <p className="num font-semibold">{inr(t.amount)}</p>
            <p className="truncate text-[13px] text-stone-500">
              {fmtDate(t.payment_date)} · {t.method}
              {t.installment_label ? ` · ${t.installment_label}` : ''}
            </p>
            {t.receipt_number && <p className="text-[12px] text-stone-400">Receipt {t.receipt_number}</p>}
            {action && <div className="mt-1.5">{action(t)}</div>}
          </div>
          {t.status !== 'Completed' && <StatusBadge status={t.status} />}
          <ReceiptButton t={t} />
        </div>
      ))}
    </Card>
  );
}

function PaymentsTab({ c }: { c: CustomerDetailData }) {
  const company = useCompanyName();
  const soon = todayStr(7);
  return (
    <>
      <h2 className="label-xs px-1 pt-1">Schedule</h2>
      {c.installments.length ? (
        <InstallmentList
          items={c.installments}
          action={(i) =>
            i.balance > 0 && (i.status === 'Overdue' || i.due_date <= soon) ? <WhatsAppLink phone={c.phone} label="Payment reminder" text={paymentReminderText(c.name, i, company)} /> : null
          }
        />
      ) : (
        <p className="px-1 text-[14px] text-stone-500">No installments.</p>
      )}
      <h2 className="label-xs px-1 pt-2">Payments received</h2>
      {c.transactions.length ? (
        <TransactionList items={c.transactions} action={(t) => (t.status === 'Completed' ? <WhatsAppLink phone={c.phone} label="Send receipt" text={receiptText(c.name, t, company)} /> : null)} />
      ) : (
        <p className="px-1 text-[14px] text-stone-500">No payments yet.</p>
      )}
    </>
  );
}
