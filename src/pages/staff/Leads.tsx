import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Search, Users, X } from 'lucide-react';
import { LEAD_PRIORITIES, LEAD_SOURCES, timeAgo, type Lead, type Paginated } from '@estateflow/shared';
import { idleLabel, type LeadInsights } from './Today';
import { ApiError, api, errorMessage } from '@/lib/api';
import { canWrite, useUser } from '@/lib/session';
import { useOffline } from '@/offline/OfflineProvider';
import { BellButton } from '@/components/shell';
import { Avatar, Badge, Button, Card, Empty, Field, IconButton, Loadable, ScoreBadge, Screen, Segmented, Sheet, StatusBadge } from '@/components/ui';
import { CallChip } from '@/components/contact';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due today' },
  { value: 'New', label: 'New' },
  { value: 'Contacted', label: 'Contacted' },
  { value: 'Qualified', label: 'Qualified' },
  { value: 'Site Visit', label: 'Site visit' },
  { value: 'Negotiation', label: 'Negotiation' },
  { value: 'Hot', label: 'Hot' },
  { value: 'stuck', label: 'Stuck' },
] as const;
type Filter = (typeof FILTERS)[number]['value'];

function queryFor(filter: Filter, q: string) {
  const out: Record<string, string> = { limit: '25' };
  if (q) out.q = q;
  if (filter === 'overdue' || filter === 'today') out.followup = filter;
  else if (filter === 'Hot') out.priority = 'Hot';
  else if (filter !== 'all') out.status = filter;
  return out;
}

/** "Stuck" comes from the lead-ageing insights (one list, longest idle first), searched on the phone. */
async function stuckPage(q: string): Promise<Paginated<Lead>> {
  const d = await api.get<LeadInsights>('/leads/insights');
  const needle = q.toLowerCase();
  const data = needle ? d.stuck.filter((l) => [l.name, l.phone, l.code].some((v) => v?.toLowerCase().includes(needle))) : d.stuck;
  return { data, meta: { page: 1, limit: data.length, total: data.length, pages: 1, hasMore: false, nextCursor: null } as Paginated<Lead>['meta'] };
}

export default function Leads() {
  const user = useUser();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('filter') as Filter) || 'all';
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [q, setQ] = useState(search);
  const adding = params.get('new') === '1';

  // Debounced search so typing does not fire a request per key.
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const query = useInfiniteQuery({
    queryKey: ['leads', 'list', filter, q],
    queryFn: ({ pageParam }) => (filter === 'stuck' ? stuckPage(q) : api.get<Paginated<Lead>>('/leads', { ...queryFor(filter, q), ...(pageParam ? { cursor: pageParam } : {}) })),
    initialPageParam: '',
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  });

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const total = query.data?.pages[0]?.meta.total;

  return (
    <Screen
      title="Leads"
      subtitle={total !== undefined ? (filter === 'stuck' ? `${total} with no contact for a week or more` : `${total} ${user.role === 'sales' ? 'assigned to you' : 'in total'}`) : undefined}
      actions={
        <>
          {canWrite(user) && <IconButton icon={Plus} label="Add lead" onClick={() => setParam('new', '1')} />}
          <BellButton />
        </>
      }
    >
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-stone-400" />
        <input type="search" aria-label="Search leads" placeholder="Name, phone or lead code" className="field pr-10 pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        {search && (
          <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-stone-400">
            <X className="size-4" />
          </button>
        )}
      </div>
      <Segmented value={filter} onChange={(v) => setParam('filter', v === 'all' ? null : v)} options={FILTERS.map((f) => ({ ...f }))} />
      <Loadable q={{ ...query, data: query.data?.pages }}>
        {(pages) => {
          const rows = pages.flatMap((p) => p.data);
          if (!rows.length)
            return (
              <Empty
                icon={Users}
                title={filter === 'stuck' && !q ? 'No stuck leads' : q || filter !== 'all' ? 'No matching leads' : 'No leads yet'}
                body={q || filter !== 'all' ? 'Try a different search or filter.' : 'Leads assigned to you will appear here.'}
                action={canWrite(user) && <Button icon={Plus} onClick={() => setParam('new', '1')}>Add a lead</Button>}
              />
            );
          return (
            <>
              <Card className="divide-y divide-stone-100">
                {rows.map((l) => (
                  <div key={l.id} className="flex items-center gap-3 px-4 py-3">
                    <Link to={`/leads/${l.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar name={l.name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate font-semibold">{l.name}</p>
                          {l.priority === 'Hot' && <Badge tone="red">Hot</Badge>}
                          <ScoreBadge score={l.score} className="ml-auto shrink-0" />
                        </div>
                        <div className="flex items-center gap-1.5 text-[13px] text-stone-500">
                          <StatusBadge status={l.status} />
                          <span className="truncate">{l.property_project || l.requirement || l.source}</span>
                        </div>
                        <p className="text-[12px] text-stone-400">
                          {l.stuck ? <span className="font-semibold text-amber-700">{idleLabel(l.idle_days)}</span> : l.last_contact ? `Contacted ${timeAgo(l.last_contact)}` : 'Not contacted yet'}
                        </p>
                      </div>
                    </Link>
                    <CallChip phone={l.phone} leadId={canWrite(user) ? l.id : undefined} name={l.name} />
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
      {adding && canWrite(user) && <QuickAddSheet onClose={() => setParam('new', null)} />}
    </Screen>
  );
}

interface DuplicateInfo {
  id: number;
  code: string;
  name: string;
  agent_name?: string | null;
  accessible: boolean;
}

function QuickAddSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { submit } = useOffline();
  const [form, setForm] = useState({ name: '', phone: '', source: 'Walk-in', priority: 'Warm', budget: '', requirement: '' });
  const [busy, setBusy] = useState(false);
  const [dup, setDup] = useState<DuplicateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    setError(null);
    setDup(null);
    const budget = form.budget ? Math.round(Number(form.budget.replace(/[^\d.]/g, ''))) : null;
    if (form.name.trim().length < 2) return setError('Enter the lead’s name.');
    if (!/^\+?[0-9 ()-]{8,16}$/.test(form.phone.trim())) return setError('Enter a valid phone number.');
    setBusy(true);
    try {
      const body = { name: form.name.trim(), phone: form.phone.trim(), source: form.source, priority: form.priority, budget, requirement: form.requirement.trim() || null };
      const r = await submit<Lead>({ kind: 'lead-create', method: 'POST', path: '/leads', body, label: `New lead ${body.name}` });
      onClose();
      if (r.state === 'sent') {
        toast.success(`${r.data.name} added`);
        navigate(`/leads/${r.data.id}`);
      }
    } catch (e) {
      const d = e instanceof ApiError ? (e.details as { code?: string; duplicate?: DuplicateInfo } | undefined) : undefined;
      if (e instanceof ApiError && e.status === 409 && d?.code === 'duplicate_phone' && d.duplicate) setDup(d.duplicate);
      else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title="New lead">
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </p>
      )}
      {dup && (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
          <p className="font-semibold">This number is already a lead</p>
          <p className="mt-0.5">
            {dup.name} ({dup.code}){dup.agent_name ? `, handled by ${dup.agent_name}` : ''}.
          </p>
          {dup.accessible ? (
            <Button
              size="sm"
              variant="secondary"
              className="mt-2"
              onClick={() => {
                onClose();
                navigate(`/leads/${dup.id}`);
              }}
            >
              Open {dup.name}
            </Button>
          ) : (
            <p className="mt-1 text-[13px]">Ask your manager to reassign it if this person should be yours.</p>
          )}
        </div>
      )}
      <Field label="Name">{(id) => <input id={id} className="field" autoComplete="off" value={form.name} onChange={set('name')} />}</Field>
      <Field label="Phone">{(id) => <input id={id} type="tel" inputMode="tel" className="field" value={form.phone} onChange={set('phone')} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Source">
          {(id) => (
            <select id={id} className="field" value={form.source} onChange={set('source')}>
              {LEAD_SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Priority">
          {(id) => (
            <select id={id} className="field" value={form.priority} onChange={set('priority')}>
              {LEAD_PRIORITIES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <Field label="Budget (₹)" hint="Optional">
        {(id) => <input id={id} inputMode="numeric" className="field num" value={form.budget} onChange={set('budget')} />}
      </Field>
      <Field label="Looking for" hint="Optional">
        {(id) => <input id={id} className="field" placeholder="3 BHK near the metro" value={form.requirement} onChange={set('requirement')} />}
      </Field>
      <Button block size="lg" onClick={save} loading={busy}>
        Add lead
      </Button>
    </Sheet>
  );
}
