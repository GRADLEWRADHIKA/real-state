import { useState } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRightLeft, CalendarPlus, CalendarRange, Mail, MapPin, MessageCircle, MessageSquarePlus, MessageSquareText, PhoneCall, StickyNote, UserCheck, UserPlus } from 'lucide-react';
import { LEAD_PIPELINE_ORDER, LEAD_STATUSES, fmtDateTime, humanDate, inr, timeAgo, type Activity, type Followup, type Lead, type SiteVisit, type Task } from '@estateflow/shared';
import { api, errorMessage } from '@/lib/api';
import { canWrite, useUser } from '@/lib/session';
import { useOffline } from '@/offline/OfflineProvider';
import { Avatar, Badge, Button, Card, Field, KeyValue, Loadable, RowLink, ScoreBadge, Screen, Section, Sheet, StatusBadge, ViewOnlyNote } from '@/components/ui';
import { ContactButtons, LogContactSheet } from '@/components/contact';
import { FollowupRow, NewFollowupSheet } from '@/components/followup';
import { ScheduleVisitSheet } from '@/components/visit';

export interface LeadDetailData extends Lead {
  activities: Activity[];
  followups: Followup[];
  siteVisits: SiteVisit[];
  tasks: Task[];
  customer?: { id: number; code: string; name: string } | null;
  duplicates?: { id: number; code: string; name: string }[];
}

const ACTIVITY_ICON: Record<string, typeof PhoneCall> = {
  call: PhoneCall,
  whatsapp: MessageCircle,
  sms: MessageSquareText,
  email: Mail,
  note: StickyNote,
  status: ArrowRightLeft,
  visit: MapPin,
  site_visit: MapPin,
  followup: CalendarRange,
  assigned: UserCheck,
  created: UserPlus,
};

export default function LeadDetail() {
  const id = Number(useParams().id);
  const user = useUser();
  const editable = canWrite(user);
  const q = useQuery({ queryKey: ['leads', id], queryFn: () => api.get<LeadDetailData>(`/leads/${id}`), enabled: Number.isFinite(id) });
  const [sheet, setSheet] = useState<'status' | 'note' | 'followup' | 'visit' | 'log' | null>(null);

  return (
    <Screen title={q.data?.name ?? 'Lead'} subtitle={q.data?.code} back="/leads">
      <Loadable q={q}>
        {(l) => {
          const pendingFollowups = l.followups.filter((f) => f.status === 'Pending');
          return (
            <>
              {!editable && <ViewOnlyNote />}
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={l.name} className="size-12 text-[15px]" />
                  <div className="min-w-0 flex-1">
                    <p className="num text-[15px] font-semibold">{l.phone}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <StatusBadge status={l.status} />
                      <StatusBadge status={l.priority} />
                      <Badge>{l.source}</Badge>
                    </div>
                  </div>
                </div>
                <ContactButtons phone={l.phone} leadId={editable ? l.id : undefined} name={l.name} className="mt-4" />
                {editable && (
                  <Button variant="ghost" size="sm" block icon={PhoneCall} className="mt-2" onClick={() => setSheet('log')}>
                    Log a call or meeting
                  </Button>
                )}
              </Card>

              {editable && (
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { key: 'status', label: 'Stage', icon: ArrowRightLeft },
                    { key: 'note', label: 'Note', icon: MessageSquarePlus },
                    { key: 'followup', label: 'Follow-up', icon: CalendarPlus },
                    { key: 'visit', label: 'Visit', icon: MapPin },
                  ].map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => setSheet(a.key as typeof sheet)}
                      className="card flex h-16 flex-col items-center justify-center gap-1 text-[12px] font-semibold text-brand-900 active:bg-stone-50"
                    >
                      <a.icon className="size-5" />
                      {a.label}
                    </button>
                  ))}
                </div>
              )}

              {l.customer && (
                <Card>
                  <RowLink to={`/customers/${l.customer.id}`}>
                    <p className="font-semibold text-brand-900">Booked as customer {l.customer.code}</p>
                    <p className="text-[13px] text-stone-500">Open payments and documents</p>
                  </RowLink>
                </Card>
              )}

              <Card className="divide-y divide-stone-100 px-4">
                {l.score !== undefined && (
                  <KeyValue label="Score">
                    <span className="flex flex-col items-end gap-0.5">
                      <ScoreBadge score={l.score} />
                      {l.score_reason && <span className={l.stuck ? 'text-[13px] font-semibold text-amber-700' : 'text-[13px] font-normal text-stone-500'}>{l.score_reason}</span>}
                    </span>
                  </KeyValue>
                )}
                {l.referred_by_name && <KeyValue label="Referral">Referred by {l.referred_by_name}</KeyValue>}
                {l.budget ? <KeyValue label="Budget">{inr(l.budget)}</KeyValue> : null}
                {l.requirement && <KeyValue label="Looking for">{l.requirement}</KeyValue>}
                {(l.property_project || l.property_name) && (
                  <KeyValue label="Interested in">
                    {l.property_project} {l.property_unit}
                  </KeyValue>
                )}
                {l.location && <KeyValue label="Location">{l.location}</KeyValue>}
                {l.email && (
                  <KeyValue label="Email">
                    <a href={`mailto:${l.email}`} className="text-brand-800">
                      {l.email}
                    </a>
                  </KeyValue>
                )}
                <KeyValue label="Agent">{l.agent_name ?? 'Unassigned'}</KeyValue>
                <KeyValue label="Last contact">{l.last_contact ? timeAgo(l.last_contact) : 'Never'}</KeyValue>
                {l.lost_reason && <KeyValue label="Lost because">{l.lost_reason}</KeyValue>}
              </Card>

              {pendingFollowups.length > 0 && (
                <Section title="Follow-ups">
                  <Card className="divide-y divide-stone-100">
                    {pendingFollowups.map((f) => (
                      <FollowupRow key={f.id} f={{ ...f, lead_name: f.lead_name ?? l.name, lead_phone: f.lead_phone ?? l.phone }} canEdit={editable} />
                    ))}
                  </Card>
                </Section>
              )}

              {l.siteVisits.length > 0 && (
                <Section title="Site visits">
                  <Card className="divide-y divide-stone-100">
                    {l.siteVisits.map((v) => (
                      <RowLink key={v.id} to={`/site-visits/${v.id}`}>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{humanDate(v.visit_date, v.visit_time)}</p>
                          <StatusBadge status={v.status} />
                        </div>
                        <p className="text-[13px] text-stone-500">{v.property_project ? `${v.property_project} ${v.property_unit ?? ''}` : 'Property to be decided'}{v.outcome ? ` · ${v.outcome}` : ''}</p>
                      </RowLink>
                    ))}
                  </Card>
                </Section>
              )}

              <Section title="Timeline">
                {l.activities.length ? (
                  <Card className="px-4 py-2">
                    <ol className="relative">
                      {l.activities.map((a, i) => {
                        const Icon = ACTIVITY_ICON[a.type] ?? StickyNote;
                        return (
                          <li key={a.id} className="relative flex gap-3 py-2.5">
                            {i < l.activities.length - 1 && <span className="absolute top-10 bottom-0 left-[15px] w-px bg-stone-200" />}
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                              <Icon className="size-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[14px] font-semibold">{a.title}</p>
                              {a.description && <p className="text-[13px] whitespace-pre-line text-stone-600">{a.description}</p>}
                              <p className="mt-0.5 text-[12px] text-stone-400" title={fmtDateTime(a.created_at)}>
                                {timeAgo(a.created_at)}
                                {a.user_name && ` · ${a.user_name}`}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </Card>
                ) : (
                  <p className="px-1 text-[14px] text-stone-500">No activity yet.</p>
                )}
              </Section>

              {sheet === 'status' && <StatusSheet lead={l} onClose={() => setSheet(null)} />}
              {sheet === 'note' && <NoteSheet lead={l} onClose={() => setSheet(null)} />}
              {sheet === 'followup' && <NewFollowupSheet leadId={l.id} name={l.name} onClose={() => setSheet(null)} />}
              {sheet === 'visit' && <ScheduleVisitSheet lead={l} onClose={() => setSheet(null)} />}
              {sheet === 'log' && <LogContactSheet leadId={l.id} name={l.name} onClose={() => setSheet(null)} />}
            </>
          );
        }}
      </Loadable>
    </Screen>
  );
}

function StatusSheet({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { submit } = useOffline();
  const [status, setStatus] = useState(lead.status);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  // Booked / Closed come from converting the lead into a booking on the dashboard.
  const options = LEAD_STATUSES.filter((s) => (s !== 'Booked' && s !== 'Closed') || lead.customer_id || s === lead.status);
  const save = async () => {
    if (status === lead.status) return onClose();
    setBusy(true);
    try {
      const r = await submit({ kind: 'lead-status', method: 'PATCH', path: `/leads/${lead.id}/status`, body: { status, reason: status === 'Lost' ? reason.trim() || null : null }, label: `${lead.name} → ${status}` });
      if (r.state === 'sent') toast.success(`Moved to ${status}`);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title="Change stage">
      <div className="space-y-1.5" role="radiogroup" aria-label="Stage">
        {options.map((s) => (
          <label key={s} className="flex h-12 items-center gap-3 rounded-xl border border-stone-200 px-4 text-[15px] font-medium has-checked:border-brand-700 has-checked:bg-brand-50">
            <input type="radio" name="lead-stage" className="size-4 accent-brand-800" checked={status === s} onChange={() => setStatus(s)} />
            <span className="flex-1">{s}</span>
            {LEAD_PIPELINE_ORDER.indexOf(s as (typeof LEAD_PIPELINE_ORDER)[number]) >= 0 && s === lead.status && <span className="text-[12px] text-stone-500">Current</span>}
          </label>
        ))}
      </div>
      {status === 'Lost' && (
        <Field label="Why was it lost?">
          {(id) => <input id={id} className="field" placeholder="Bought elsewhere" value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
      )}
      <Button block onClick={save} loading={busy}>
        Save stage
      </Button>
    </Sheet>
  );
}

function NoteSheet({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { submit } = useOffline();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!note.trim()) return toast.error('Write a note first');
    setBusy(true);
    try {
      const r = await submit({ kind: 'note', method: 'POST', path: `/leads/${lead.id}/notes`, body: { note: note.trim() }, label: `Note on ${lead.name}` });
      if (r.state === 'sent') toast.success('Note added');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title={`Note on ${lead.name}`}>
      <Field label="Note">{(id) => <textarea id={id} rows={4} className="field" value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
      <Button block onClick={save} loading={busy}>
        Add note
      </Button>
    </Sheet>
  );
}
