import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { BellRing, CalendarCheck, Check, Clock, IndianRupee, LogIn, LogOut, MapPin, PhoneCall, PhoneForwarded, Sun, Target } from 'lucide-react';
import { firstName, fmtDateLong, fmtDateShort, fmtTime, greeting, inr, inrShort, relativeDay, STUCK_LEAD_DAYS, type AttendanceRecord, type Followup, type Lead, type SiteVisit, type Task, type TargetRow } from '@estateflow/shared';
import { api, errorMessage } from '@/lib/api';
import { kv } from '@/lib/platform';
import { currentPosition } from '@/lib/device';
import { canWrite, useUser } from '@/lib/session';
import { enableReminders, remindersOn, remindersSupported } from '@/lib/reminders';
import { BellButton } from '@/components/shell';
import { Badge, Button, Card, Empty, Loadable, Screen, Section, StatusBadge, ViewOnlyNote } from '@/components/ui';
import { CallChip } from '@/components/contact';
import { FollowupRow } from '@/components/followup';

export interface TodayData {
  date: string;
  visits: (SiteVisit & { property_city?: string | null })[];
  followups: { today: Followup[]; overdue: Followup[] };
  tasks: Task[];
  dues: { id: number; label: string; due_date: string; amount: number; paid_amount: number; balance: number; customer_id: number; customer_name: string; customer_phone: string }[];
}

export const useToday = () => useQuery({ queryKey: ['today'], queryFn: () => api.get<TodayData>('/dashboard/today') });

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: 'red' }) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-2.5">
      <p className={clsx('num font-display text-[22px] leading-none font-semibold', tone === 'red' && Number(value) > 0 ? 'text-gold-300' : 'text-white')}>{value}</p>
      <p className="mt-1 text-[11px] text-white/70">{label}</p>
    </div>
  );
}

/** Polite one-time ask for on-device reminders (Android only). */
function ReminderPrompt() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!remindersSupported) return;
    void Promise.all([remindersOn(), kv.get('ef_reminders_asked')]).then(([on, asked]) => setShow(!on && !asked));
  }, []);
  if (!show) return null;
  const dismiss = () => {
    setShow(false);
    void kv.set('ef_reminders_asked', '1');
  };
  return (
    <Card className="flex gap-3 p-4">
      <BellRing className="mt-0.5 size-5 shrink-0 text-brand-700" />
      <div className="flex-1">
        <p className="font-semibold">Remind me before visits and calls</p>
        <p className="mt-0.5 text-[13px] text-stone-500">A reminder on this phone 15 minutes before each of today's follow-ups and site visits.</p>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            onClick={async () => {
              dismiss();
              if (await enableReminders()) toast.success('Reminders are on');
              else toast('Reminders are off. You can turn them on from Profile.');
            }}
          >
            Turn on
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss}>
            Not now
          </Button>
        </div>
      </div>
    </Card>
  );
}

const clock = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase() : '');

/** Today's attendance: check in (with GPS when the phone gives a fix) and check out. */
function AttendanceCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['attendance', 'me'], queryFn: () => api.get<AttendanceRecord>('/staff/attendance/me') });
  const [busy, setBusy] = useState<'in' | 'out' | null>(null);
  const a = q.data;

  const act = async (kind: 'in' | 'out') => {
    setBusy(kind);
    try {
      const body = kind === 'in' ? await currentPosition().then((pos) => (pos ? { lat: pos.lat, lng: pos.lng } : {})) : {};
      const r = await api.post<AttendanceRecord>(`/staff/attendance/check-${kind}`, body);
      qc.setQueryData(['attendance', 'me'], r);
      toast.success(kind === 'in' ? `Checked in at ${clock(r.check_in_at)}` : `Checked out at ${clock(r.check_out_at)}`);
    } catch (e) {
      toast.error(errorMessage(e));
      void q.refetch();
    } finally {
      setBusy(null);
    }
  };

  if (!a) return null;
  const state = a.check_out_at ? 'Checked out' : a.check_in_at ? 'Checked in' : a.status ? a.status : 'Not checked in';
  return (
    <Card className="flex items-center gap-3 p-4">
      <Clock className="size-5 shrink-0 text-brand-700" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold">Attendance</p>
          <Badge tone={a.check_out_at ? 'gray' : a.check_in_at ? 'green' : a.status === 'Absent' ? 'red' : a.status ? 'amber' : 'gray'}>{state}</Badge>
        </div>
        <p className="num text-[13px] text-stone-500">
          {a.check_in_at ? `In ${clock(a.check_in_at)}` : 'You have not checked in today'}
          {a.check_out_at && ` · Out ${clock(a.check_out_at)}`}
        </p>
      </div>
      {!a.check_in_at ? (
        <Button size="sm" icon={LogIn} loading={busy === 'in'} onClick={() => void act('in')}>
          Check in
        </Button>
      ) : !a.check_out_at ? (
        <Button size="sm" variant="secondary" icon={LogOut} loading={busy === 'out'} onClick={() => void act('out')}>
          Check out
        </Button>
      ) : null}
    </Card>
  );
}

/** This month's booking target: own row for sales, own row (or the team total) for the manager. */
function TargetCard({ userId }: { userId: number }) {
  const q = useQuery({ queryKey: ['targets', 'me'], queryFn: () => api.get<{ data: TargetRow[]; meta: { month: string } }>('/staff/targets') });
  if (!q.data) return null;
  const own = q.data.data.find((r) => r.user_id === userId);
  const rows = own ? [own] : q.data.data;
  const target = rows.reduce((s, r) => s + (r.monthly_target || 0), 0);
  const achieved = rows.reduce((s, r) => s + (r.achieved || 0), 0);
  const bookings = rows.reduce((s, r) => s + (r.bookings || 0), 0);
  if (!target && !achieved) return null;
  const pct = target ? Math.min(100, (achieved / target) * 100) : 100;
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <Target className="size-5 shrink-0 text-brand-700" />
        <p className="flex-1 font-semibold">{own ? 'This month' : 'Team this month'}</p>
        <p className="text-[13px] text-stone-500">
          {bookings} booking{bookings === 1 ? '' : 's'}
        </p>
      </div>
      <p className="num mt-2 text-[15px]">
        <span className="font-semibold text-brand-900">{inrShort(achieved)}</span>
        {target > 0 && <span className="text-stone-500"> of {inrShort(target)}</span>}
      </p>
      {target > 0 && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className={clsx('h-full rounded-full', pct >= 100 ? 'bg-gold-400' : 'bg-brand-700')} style={{ width: `${pct}%` }} />
        </div>
      )}
    </Card>
  );
}

export interface LeadInsights {
  days: number;
  open: number;
  stuck: Lead[];
  hot: Lead[];
  byAgent: { agent_id: number | null; agent_name: string; stuck: number }[];
}

/** Open leads nobody has contacted for STUCK_LEAD_DAYS days (scoped to the executive by the server). */
export const useLeadInsights = () => useQuery({ queryKey: ['leads', 'insights'], queryFn: () => api.get<LeadInsights>('/leads/insights', { days: STUCK_LEAD_DAYS }) });

/** The user's own stuck leads, longest idle first. */
export const ownStuck = (d: LeadInsights | undefined, userId: number) => (d?.stuck ?? []).filter((l) => l.assigned_to === userId);

export const idleLabel = (days?: number) => (days === undefined ? '' : days === 1 ? '1 day idle' : `${days} days idle`);

/** Up to three of the user's leads that have gone quiet, with a call button each. */
function NeedsCallCard({ userId }: { userId: number }) {
  const q = useLeadInsights();
  const stuck = ownStuck(q.data, userId);
  if (!stuck.length) return null;
  return (
    <Section
      title={`Needs a call · ${stuck.length}`}
      action={
        <Link to="/leads?filter=stuck" className="text-[13px] font-semibold text-brand-800">
          See all
        </Link>
      }
    >
      <Card className="divide-y divide-stone-100">
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 text-[13px] text-stone-500">
          <PhoneForwarded className="size-4 shrink-0 text-amber-600" />
          No contact for {STUCK_LEAD_DAYS}+ days. A quick call keeps them warm.
        </div>
        {stuck.slice(0, 3).map((l) => (
          <div key={l.id} className="flex items-center gap-3 px-4 py-3">
            <Link to={`/leads/${l.id}`} className="min-w-0 flex-1">
              <p className="truncate font-semibold">{l.name}</p>
              <p className="text-[13px]">
                <span className="font-semibold text-amber-700">{idleLabel(l.idle_days)}</span>
                <span className="text-stone-500"> · {l.status}</span>
              </p>
            </Link>
            <CallChip phone={l.phone} leadId={l.id} name={l.name} />
          </div>
        ))}
      </Card>
    </Section>
  );
}

function VisitCard({ v }: { v: TodayData['visits'][number] }) {
  const state = v.status === 'Completed' ? 'Done' : v.checked_in_at ? 'On site' : null;
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="w-16 shrink-0 text-center">
        <p className="num font-display text-[17px] font-semibold text-brand-900">{fmtTime(v.visit_time).replace(/ (AM|PM)/, '')}</p>
        <p className="text-[11px] text-stone-500">{fmtTime(v.visit_time).slice(-2)}</p>
      </div>
      <Link to={`/site-visits/${v.id}`} className="min-w-0 flex-1">
        <p className="truncate font-semibold">{v.lead_name}</p>
        <p className="flex items-center gap-1 truncate text-[13px] text-stone-500">
          <MapPin className="size-3.5 shrink-0" />
          {v.property_project ? `${v.property_project} ${v.property_unit ?? ''}` : 'Property to be decided'}
        </p>
        {state && <Badge tone={state === 'Done' ? 'green' : 'gold'} className="mt-1">{state}</Badge>}
      </Link>
      <CallChip phone={v.lead_phone} leadId={v.lead_id} name={v.lead_name} />
    </Card>
  );
}

function TaskRow({ t, canEdit }: { t: Task; canEdit: boolean }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const done = async () => {
    setBusy(true);
    try {
      await api.put(`/tasks/${t.id}`, { status: 'Completed' });
      void qc.invalidateQueries({ queryKey: ['today'] });
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task completed');
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  };
  const link = t.lead_id ? `/leads/${t.lead_id}` : t.customer_id ? `/customers/${t.customer_id}` : null;
  const body = (
    <>
      <p className="font-semibold">{t.title}</p>
      <p className="text-[13px] text-stone-500">
        {t.due_date ? relativeDay(t.due_date) : 'No due date'}
        {(t.lead_name || t.customer_name) && ` · ${t.lead_name || t.customer_name}`}
      </p>
    </>
  );
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {canEdit && (
        <button type="button" aria-label={`Complete task ${t.title}`} disabled={busy} onClick={done} className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-stone-300 text-transparent active:border-brand-700 active:text-brand-700">
          <Check className="size-4" />
        </button>
      )}
      {link ? (
        <Link to={link} className="min-w-0 flex-1">
          {body}
        </Link>
      ) : (
        <div className="min-w-0 flex-1">{body}</div>
      )}
      {(t.priority === 'High' || t.priority === 'Urgent') && <StatusBadge status={t.priority} />}
    </div>
  );
}

export default function Today() {
  const user = useUser();
  const q = useToday();
  const editable = canWrite(user);
  const isAccounts = user.role === 'accounts';

  return (
    <Screen title={`${greeting()}, ${firstName(user.name)}`} subtitle={fmtDateLong(q.data?.date ?? new Date().toISOString().slice(0, 10))} actions={<BellButton />}>
      {!editable && <ViewOnlyNote />}
      <ReminderPrompt />
      {editable && <AttendanceCard />}
      {(user.role === 'sales' || user.role === 'manager') && <TargetCard userId={user.id} />}
      <Loadable q={q}>
        {(d) => {
          const followups = [...d.followups.overdue, ...d.followups.today];
          const dueTotal = d.dues.reduce((s, x) => s + x.balance, 0);
          const nothing = !d.visits.length && !followups.length && !d.tasks.length && !d.dues.length;
          return (
            <>
              <div className="grid grid-cols-3 gap-2 rounded-3xl bg-brand-950 p-3">
                {isAccounts ? (
                  <>
                    <Stat label="Dues to collect" value={d.dues.length} tone="red" />
                    <Stat label="Amount due" value={inr(dueTotal).replace('₹', '₹ ')} />
                    <Stat label="Tasks" value={d.tasks.length} />
                  </>
                ) : (
                  <>
                    <Stat label="Site visits" value={d.visits.length} />
                    <Stat label="Follow-ups today" value={d.followups.today.length} />
                    <Stat label="Overdue" value={d.followups.overdue.length} tone="red" />
                  </>
                )}
              </div>

              {nothing && <Empty icon={Sun} title="A clear day" body="Nothing is due today. New follow-ups, visits and tasks will show up here." />}

              {editable && !isAccounts && <NeedsCallCard userId={user.id} />}

              {d.visits.length > 0 && (
                <Section title="Site visits" action={<Link to="/site-visits" className="text-[13px] font-semibold text-brand-800">All visits</Link>}>
                  <div className="space-y-2">
                    {d.visits.map((v) => (
                      <VisitCard key={v.id} v={v} />
                    ))}
                  </div>
                </Section>
              )}

              {followups.length > 0 && (
                <Section
                  title={d.followups.overdue.length ? `Follow-ups · ${d.followups.overdue.length} overdue` : 'Follow-ups'}
                  action={<Link to={d.followups.overdue.length ? '/followups?bucket=overdue' : '/followups'} className="text-[13px] font-semibold text-brand-800">See all</Link>}
                >
                  <Card className="divide-y divide-stone-100">
                    {followups.map((f) => (
                      <FollowupRow key={f.id} f={f} canEdit={editable} />
                    ))}
                  </Card>
                </Section>
              )}

              {d.dues.length > 0 && (
                <Section title="Dues up to today">
                  <Card className="divide-y divide-stone-100">
                    {d.dues.map((x) => (
                      <div key={x.id} className="flex items-center gap-3 px-4 py-3">
                        <Link to={`/customers/${x.customer_id}?tab=payments`} className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{x.customer_name}</p>
                          <p className="text-[13px] text-stone-500">
                            {x.label} · due {fmtDateShort(x.due_date)}
                          </p>
                        </Link>
                        <p className="num text-right font-semibold text-red-700">{inr(x.balance)}</p>
                        <CallChip phone={x.customer_phone} name={x.customer_name} />
                      </div>
                    ))}
                  </Card>
                </Section>
              )}

              {d.tasks.length > 0 && (
                <Section title="Tasks" action={<Link to="/tasks" className="text-[13px] font-semibold text-brand-800">All tasks</Link>}>
                  <Card className="divide-y divide-stone-100">
                    {d.tasks.map((t) => (
                      <TaskRow key={t.id} t={t} canEdit={editable} />
                    ))}
                  </Card>
                </Section>
              )}

              {!isAccounts && (
                <div className={clsx('grid gap-2 pt-2', editable ? 'grid-cols-2' : 'grid-cols-1')}>
                  {editable && (
                    <Link to="/leads?new=1" className="card flex h-14 items-center justify-center gap-2 font-semibold text-brand-900 active:bg-stone-50">
                      <PhoneCall className="size-[18px]" /> New lead
                    </Link>
                  )}
                  <Link to="/site-visits" className="card flex h-14 items-center justify-center gap-2 font-semibold text-brand-900 active:bg-stone-50">
                    <CalendarCheck className="size-[18px]" /> Visits
                  </Link>
                </div>
              )}
              {isAccounts && (
                <Link to="/customers" className="card flex h-14 items-center justify-center gap-2 font-semibold text-brand-900 active:bg-stone-50">
                  <IndianRupee className="size-[18px]" /> All customers
                </Link>
              )}
            </>
          );
        }}
      </Loadable>
    </Screen>
  );
}

export { TaskRow };
