import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Download, Loader2, Search, UserRound } from 'lucide-react';
import {
  fmtDate,
  fmtDateShort,
  inr,
  inrShort,
  timeAgo,
  type Activity,
  type Customer,
  type CustomerRequest,
  type DocumentItem,
  type Financials,
  type Installment,
  type Paginated,
  type Property,
  type Transaction,
} from '@estateflow/shared';
import { api } from '@/lib/api';
import { useUser } from '@/lib/session';
import { BellButton } from '@/components/shell';
import { Avatar, Button, Card, Empty, KeyValue, Loadable, RowLink, Screen, Segmented, StatusBadge } from '@/components/ui';
import { ContactButtons, CallChip } from '@/components/contact';
import { DocumentRow, useDownload } from '@/components/files';
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
  activities: Activity[];
  financials: Financials;
  requests: CustomerRequest[];
}

type Tab = 'overview' | 'payments' | 'documents' | 'requests';

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
                { value: 'documents', label: `Documents · ${c.documents.length}` },
                { value: 'requests', label: `Requests · ${c.requests.length}` },
              ]}
            />
            {tab === 'overview' && <Overview c={c} />}
            {tab === 'payments' && <PaymentsTab c={c} />}
            {tab === 'documents' &&
              (c.documents.length ? (
                <Card className="divide-y divide-stone-100">
                  {c.documents.map((d) => (
                    <DocumentRow key={d.id} d={d} />
                  ))}
                </Card>
              ) : (
                <Empty icon={UserRound} title="No documents yet" />
              ))}
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
      <Card className="divide-y divide-stone-100 px-4">
        <KeyValue label="Booked on">{fmtDate(c.booking_date)}</KeyValue>
        {c.deal && <KeyValue label="Deal stage">{c.deal.stage}</KeyValue>}
        {c.property?.construction_stage && <KeyValue label="Construction">{c.property.construction_stage}</KeyValue>}
        {c.agent_name && <KeyValue label="Agent">{c.agent_name}</KeyValue>}
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

export function InstallmentList({ items }: { items: Installment[] }) {
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
          <StatusBadge status={i.status} />
        </div>
      ))}
    </Card>
  );
}

export function TransactionList({ items, highlight }: { items: Transaction[]; highlight?: number }) {
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
          </div>
          {t.status !== 'Completed' && <StatusBadge status={t.status} />}
          <ReceiptButton t={t} />
        </div>
      ))}
    </Card>
  );
}

function PaymentsTab({ c }: { c: CustomerDetailData }) {
  return (
    <>
      <h2 className="label-xs px-1 pt-1">Schedule</h2>
      {c.installments.length ? <InstallmentList items={c.installments} /> : <p className="px-1 text-[14px] text-stone-500">No installments.</p>}
      <h2 className="label-xs px-1 pt-2">Payments received</h2>
      {c.transactions.length ? <TransactionList items={c.transactions} /> : <p className="px-1 text-[14px] text-stone-500">No payments yet.</p>}
    </>
  );
}
