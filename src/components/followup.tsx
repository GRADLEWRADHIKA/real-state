import { useState } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, Check } from 'lucide-react';
import clsx from 'clsx';
import { FOLLOWUP_TYPES, addDays, fmtDateShort, fmtTime, relativeDay, todayStr, type Followup } from '@estateflow/shared';
import { api, errorMessage } from '@/lib/api';
import { useOffline } from '@/offline/OfflineProvider';
import { Badge, Button, Field, Segmented, Sheet } from './ui';
import { CallChip } from './contact';

export function FollowupRow({ f, canEdit }: { f: Followup; canEdit: boolean }) {
  const [sheet, setSheet] = useState<'done' | 'move' | null>(null);
  const overdue = f.status === 'Pending' && f.due_date < todayStr();
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Link to={`/leads/${f.lead_id}`} className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">{f.lead_name}</p>
          <Badge tone={f.type === 'Site Visit' ? 'gold' : 'gray'}>{f.type}</Badge>
        </div>
        <p className={clsx('num text-[13px]', overdue ? 'font-semibold text-red-600' : 'text-stone-500')}>
          {overdue ? `${relativeDay(f.due_date)} · ${fmtDateShort(f.due_date)}` : relativeDay(f.due_date)} · {fmtTime(f.due_time)}
        </p>
        {f.notes && <p className="truncate text-[13px] text-stone-500">{f.notes}</p>}
      </Link>
      <CallChip phone={f.lead_phone} leadId={f.lead_id} name={f.lead_name} />
      {canEdit && f.status === 'Pending' && (
        <>
          <button type="button" aria-label={`Reschedule follow-up with ${f.lead_name}`} onClick={() => setSheet('move')} className="grid size-10 place-items-center rounded-full text-stone-600 active:bg-stone-100">
            <CalendarClock className="size-[18px]" />
          </button>
          <button type="button" aria-label={`Complete follow-up with ${f.lead_name}`} onClick={() => setSheet('done')} className="grid size-10 place-items-center rounded-full bg-brand-900 text-white active:bg-brand-950">
            <Check className="size-[18px]" />
          </button>
        </>
      )}
      {f.status !== 'Pending' && <Badge tone={f.status === 'Completed' ? 'green' : 'red'}>{f.status}</Badge>}
      {sheet === 'done' && <CompleteFollowupSheet f={f} onClose={() => setSheet(null)} />}
      {sheet === 'move' && <RescheduleSheet f={f} onClose={() => setSheet(null)} />}
    </div>
  );
}

function CompleteFollowupSheet({ f, onClose }: { f: Followup; onClose: () => void }) {
  const { submit } = useOffline();
  const [outcome, setOutcome] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await submit({ kind: 'followup-complete', method: 'PUT', path: `/followups/${f.id}`, body: { status: 'Completed', outcome: outcome.trim() || null }, label: `Follow-up with ${f.lead_name}` });
      if (r.state === 'sent') toast.success('Follow-up completed');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title={`Complete: ${f.lead_name}`}>
      <Field label="Outcome" hint="Optional">
        {(id) => <textarea id={id} rows={3} className="field" placeholder="Spoke to them, sending the cost sheet" value={outcome} onChange={(e) => setOutcome(e.target.value)} />}
      </Field>
      <Button block onClick={save} loading={busy}>
        Mark as done
      </Button>
    </Sheet>
  );
}

function RescheduleSheet({ f, onClose }: { f: Followup; onClose: () => void }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(f.due_date < todayStr() ? todayStr() : f.due_date);
  const [time, setTime] = useState(f.due_time);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/followups/${f.id}`, { due_date: date, due_time: time });
      void qc.invalidateQueries({ queryKey: ['followups'] });
      void qc.invalidateQueries({ queryKey: ['today'] });
      void qc.invalidateQueries({ queryKey: ['leads'] });
      toast.success(`Moved to ${fmtDateShort(date)}, ${fmtTime(time)}`);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title={`Reschedule: ${f.lead_name}`}>
      <div className="flex gap-2">
        {[
          ['Tomorrow', 1],
          ['In 3 days', 3],
          ['Next week', 7],
        ].map(([label, d]) => (
          <Button key={label} variant="secondary" size="sm" onClick={() => setDate(addDays(todayStr(), d as number))}>
            {label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">{(id) => <input id={id} type="date" className="field" min={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label="Time">{(id) => <input id={id} type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
      </div>
      <Button block onClick={save} loading={busy}>
        Reschedule
      </Button>
    </Sheet>
  );
}

/** New follow-up for a lead. */
export function NewFollowupSheet({ leadId, name, onClose }: { leadId: number; name: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState<(typeof FOLLOWUP_TYPES)[number]>('Call');
  const [date, setDate] = useState(addDays(todayStr(), 1));
  const [time, setTime] = useState('11:00');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.post('/followups', { lead_id: leadId, due_date: date, due_time: time, type, notes: notes.trim() || null });
      for (const k of ['followups', 'today', 'leads']) void qc.invalidateQueries({ queryKey: [k] });
      toast.success('Follow-up scheduled');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title={`Follow up with ${name}`}>
      <Segmented value={type} onChange={setType} options={FOLLOWUP_TYPES.map((t) => ({ value: t, label: t }))} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">{(id) => <input id={id} type="date" className="field" min={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label="Time">{(id) => <input id={id} type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
      </div>
      <Field label="Notes" hint="Optional">
        {(id) => <textarea id={id} rows={2} className="field" value={notes} onChange={(e) => setNotes(e.target.value)} />}
      </Field>
      <Button block onClick={save} loading={busy}>
        Schedule follow-up
      </Button>
    </Sheet>
  );
}
