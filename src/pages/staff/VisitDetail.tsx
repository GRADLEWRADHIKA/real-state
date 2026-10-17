import { useState } from 'react';
import { useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Camera, CalendarClock, LogIn, LogOut, MapPin, XCircle } from 'lucide-react';
import { UPLOAD_ALLOWED, VISIT_OUTCOMES, fmtDateTime, fmtTime, humanDate, todayStr, type DocumentItem, type SiteVisit } from '@estateflow/shared';
import { api, errorMessage } from '@/lib/api';
import { isNative } from '@/lib/platform';
import { useOnline } from '@/lib/network';
import { currentPosition, takePhoto } from '@/lib/device';
import { canWrite, useUser } from '@/lib/session';
import { useOffline } from '@/offline/OfflineProvider';
import { Badge, Button, Card, Field, KeyValue, Loadable, RowLink, Screen, Section, Sheet, StatusBadge, ViewOnlyNote } from '@/components/ui';
import { ContactButtons, MapsLink } from '@/components/contact';
import { AuthImage, useFilePicker } from '@/components/files';

type VisitDetailData = SiteVisit & { property_city?: string | null; photo_documents: DocumentItem[] };

export default function VisitDetail() {
  const id = Number(useParams().id);
  const user = useUser();
  const editable = canWrite(user);
  const qc = useQueryClient();
  const online = useOnline();
  const { submit } = useOffline();
  const key = ['site-visits', id];
  const q = useQuery({ queryKey: key, queryFn: () => api.get<VisitDetailData>(`/site-visits/${id}`), enabled: Number.isFinite(id) });
  const [busy, setBusy] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'checkout' | 'reschedule' | 'cancel' | null>(null);

  /** Shows the change at once, whether it reached the server or is waiting offline. */
  const patchLocal = (patch: Partial<VisitDetailData>) => qc.setQueryData<VisitDetailData>(key, (v) => (v ? { ...v, ...patch } : v));

  const checkIn = async (v: VisitDetailData) => {
    setBusy('checkin');
    const at = new Date().toISOString();
    const pos = await currentPosition();
    try {
      const r = await submit({ kind: 'check-in', method: 'POST', path: `/site-visits/${v.id}/check-in`, body: { lat: pos?.lat ?? null, lng: pos?.lng ?? null, at }, label: `Check-in for ${v.lead_name}` });
      patchLocal({ checked_in_at: at, checkin_lat: pos?.lat ?? null, checkin_lng: pos?.lng ?? null });
      if (r.state === 'sent') toast.success(pos ? 'Checked in with your location' : 'Checked in (location unavailable)');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const uploadPhoto = async (v: VisitDetailData, file: File) => {
    setBusy('photo');
    try {
      const form = new FormData();
      form.append('entity_type', 'site_visit');
      form.append('entity_id', String(v.id));
      form.append('doc_type', 'Photo');
      form.append('name', file.name);
      form.append('file', file);
      await api.upload('/documents', form);
      await qc.invalidateQueries({ queryKey: key });
      toast.success('Photo added');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const picker = useFilePicker(Object.keys(UPLOAD_ALLOWED).filter((m) => m.startsWith('image/')).join(','), (f) => q.data && void uploadPhoto(q.data, f), 'environment');

  const addPhoto = async (v: VisitDetailData) => {
    if (!online) return toast.error('Photos need a connection. Add them once you are back online.');
    if (!isNative) return picker.open();
    try {
      const f = await takePhoto();
      if (f) await uploadPhoto(v, f);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <Screen title={q.data ? `Visit · ${q.data.lead_name}` : 'Site visit'} subtitle={q.data && humanDate(q.data.visit_date, q.data.visit_time)} back="/site-visits">
      <Loadable q={q}>
        {(v) => {
          const open = v.status === 'Scheduled' || v.status === 'Rescheduled';
          const where = v.property_project ? `${v.property_project} ${v.property_unit ?? ''}`.trim() : null;
          const place = [v.property_project, v.property_location, v.property_city].filter(Boolean).join(', ');
          return (
            <>
              {!editable && <ViewOnlyNote />}
              <Card className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={v.status} />
                    {v.checked_in_at && !v.checked_out_at && <Badge tone="gold">On site since {fmtTime(new Date(v.checked_in_at).toTimeString().slice(0, 5))}</Badge>}
                  </div>
                  {place && <MapsLink query={place} lat={v.checkin_lat} lng={v.checkin_lng} />}
                </div>
                <p className="mt-3 font-display text-[19px] font-semibold text-brand-950">{where ?? 'Property to be decided on site'}</p>
                {v.property_location && (
                  <p className="flex items-center gap-1 text-[14px] text-stone-500">
                    <MapPin className="size-4" />
                    {v.property_location}
                  </p>
                )}
                <ContactButtons phone={v.lead_phone} leadId={editable ? v.lead_id : undefined} name={v.lead_name} className="mt-4" />
              </Card>

              {editable && open && (
                <>
                  {!v.checked_in_at ? (
                    <Button size="lg" block icon={LogIn} loading={busy === 'checkin'} onClick={() => void checkIn(v)}>
                      Check in at site
                    </Button>
                  ) : (
                    <Button size="lg" variant="gold" block icon={LogOut} onClick={() => setSheet('checkout')}>
                      Check out and record outcome
                    </Button>
                  )}
                  {!v.checked_in_at && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" icon={CalendarClock} onClick={() => setSheet('reschedule')}>
                        Reschedule
                      </Button>
                      <Button variant="secondary" icon={XCircle} onClick={() => setSheet('cancel')}>
                        Cancel visit
                      </Button>
                    </div>
                  )}
                </>
              )}

              <Card className="divide-y divide-stone-100 px-4">
                <KeyValue label="When">{humanDate(v.visit_date, v.visit_time)}</KeyValue>
                {v.agent_name && <KeyValue label="Agent">{v.agent_name}</KeyValue>}
                {v.checked_in_at && <KeyValue label="Checked in">{fmtDateTime(v.checked_in_at)}</KeyValue>}
                {v.checked_out_at && <KeyValue label="Checked out">{fmtDateTime(v.checked_out_at)}</KeyValue>}
                {v.outcome && <KeyValue label="Outcome">{v.outcome}</KeyValue>}
                {v.feedback && <KeyValue label="Feedback">{v.feedback}</KeyValue>}
                {v.next_action && <KeyValue label="Next step">{v.next_action}</KeyValue>}
              </Card>

              <Card>
                <RowLink to={`/leads/${v.lead_id}`}>
                  <p className="font-semibold">{v.lead_name}</p>
                  <p className="text-[13px] text-stone-500">Open lead and timeline</p>
                </RowLink>
              </Card>

              <Section
                title={`Photos${v.photo_documents.length ? ` · ${v.photo_documents.length}` : ''}`}
                action={
                  editable && (
                    <Button size="sm" variant="ghost" icon={Camera} loading={busy === 'photo'} onClick={() => void addPhoto(v)}>
                      Add photo
                    </Button>
                  )
                }
              >
                {picker.input}
                {v.photo_documents.length ? (
                  <div className="grid grid-cols-3 gap-2">
                    {v.photo_documents.map((p) => (
                      <AuthImage key={p.id} docId={p.id} name={p.name} className="aspect-square w-full rounded-xl object-cover" />
                    ))}
                  </div>
                ) : (
                  <p className="px-1 text-[14px] text-stone-500">No photos yet.</p>
                )}
              </Section>

              {sheet === 'checkout' && <CheckOutSheet v={v} onClose={() => setSheet(null)} onDone={patchLocal} />}
              {sheet === 'reschedule' && <RescheduleVisitSheet v={v} onClose={() => setSheet(null)} />}
              {sheet === 'cancel' && <CancelVisitSheet v={v} onClose={() => setSheet(null)} />}
            </>
          );
        }}
      </Loadable>
    </Screen>
  );
}

function CheckOutSheet({ v, onClose, onDone }: { v: VisitDetailData; onClose: () => void; onDone: (p: Partial<VisitDetailData>) => void }) {
  const { submit } = useOffline();
  const [outcome, setOutcome] = useState<string>('');
  const [feedback, setFeedback] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!outcome) return toast.error('Choose how the visit went');
    setBusy(true);
    const at = new Date().toISOString();
    const pos = await currentPosition(6000);
    try {
      const body = { outcome, feedback: feedback.trim() || null, next_action: next.trim() || null, lat: pos?.lat ?? null, lng: pos?.lng ?? null, at };
      const r = await submit({ kind: 'check-out', method: 'POST', path: `/site-visits/${v.id}/check-out`, body, label: `Check-out for ${v.lead_name}` });
      onDone({ status: 'Completed', checked_out_at: at, outcome, feedback: body.feedback, next_action: body.next_action });
      if (r.state === 'sent') toast.success('Visit completed');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title="How did the visit go?">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Outcome">
        {VISIT_OUTCOMES.map((o) => (
          <label key={o} className="flex min-h-12 items-center gap-2 rounded-xl border border-stone-200 px-3 text-[14px] font-medium has-checked:border-brand-700 has-checked:bg-brand-50">
            <input type="radio" name="visit-outcome" className="size-4 accent-brand-800" checked={outcome === o} onChange={() => setOutcome(o)} />
            {o}
          </label>
        ))}
      </div>
      <Field label="Feedback" hint="Optional">
        {(id) => <textarea id={id} rows={2} className="field" placeholder="Liked the layout, wants a higher floor" value={feedback} onChange={(e) => setFeedback(e.target.value)} />}
      </Field>
      <Field label="Next step" hint="Optional">
        {(id) => <input id={id} className="field" placeholder="Share revised cost sheet" value={next} onChange={(e) => setNext(e.target.value)} />}
      </Field>
      <Button block size="lg" onClick={save} loading={busy}>
        Check out
      </Button>
    </Sheet>
  );
}

function useVisitUpdate(v: SiteVisit, onClose: () => void) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const run = async (body: Record<string, unknown>, message: string) => {
    setBusy(true);
    try {
      await api.put(`/site-visits/${v.id}`, body);
      for (const k of ['site-visits', 'today', 'leads']) void qc.invalidateQueries({ queryKey: [k] });
      toast.success(message);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

function RescheduleVisitSheet({ v, onClose }: { v: SiteVisit; onClose: () => void }) {
  const [date, setDate] = useState(v.visit_date < todayStr() ? todayStr() : v.visit_date);
  const [time, setTime] = useState(v.visit_time);
  const { busy, run } = useVisitUpdate(v, onClose);
  return (
    <Sheet open onClose={onClose} title="Reschedule visit">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">{(id) => <input id={id} type="date" className="field" min={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label="Time">{(id) => <input id={id} type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
      </div>
      <Button block loading={busy} onClick={() => void run({ visit_date: date, visit_time: time, status: 'Rescheduled' }, 'Visit rescheduled')}>
        Save new time
      </Button>
    </Sheet>
  );
}

function CancelVisitSheet({ v, onClose }: { v: SiteVisit; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const { busy, run } = useVisitUpdate(v, onClose);
  return (
    <Sheet open onClose={onClose} title="Cancel this visit?">
      <p className="text-[14px] text-stone-600">
        {v.lead_name}'s visit on {humanDate(v.visit_date, v.visit_time)} will be marked cancelled.
      </p>
      <Field label="Reason" hint="Optional">
        {(id) => <input id={id} className="field" value={reason} onChange={(e) => setReason(e.target.value)} />}
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={onClose}>
          Keep visit
        </Button>
        <Button variant="danger" loading={busy} onClick={() => void run({ status: 'Cancelled', feedback: reason.trim() || null }, 'Visit cancelled')}>
          Cancel visit
        </Button>
      </div>
    </Sheet>
  );
}
