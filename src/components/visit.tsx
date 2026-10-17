import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { addDays, inrShort, todayStr, type Lead, type Paginated, type Property, type SiteVisit } from '@estateflow/shared';
import { api, errorMessage } from '@/lib/api';
import { Button, Field, Sheet } from './ui';

/** Books a site visit; pass the lead when scheduling from a lead, otherwise the person picks one. */
export function ScheduleVisitSheet({ lead, onClose }: { lead?: Pick<Lead, 'id' | 'name' | 'property_id'>; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [leadId, setLeadId] = useState<number | null>(lead?.id ?? null);
  const [leadSearch, setLeadSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [propertyId, setPropertyId] = useState<number | ''>(lead?.property_id ?? '');
  const [date, setDate] = useState(addDays(todayStr(), 1));
  const [time, setTime] = useState('11:00');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(leadSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [leadSearch]);

  const properties = useQuery({
    queryKey: ['properties', 'available'],
    queryFn: () => api.get<Paginated<Property>>('/properties', { available: '1', limit: 200 }),
  });
  const leads = useQuery({
    queryKey: ['leads', 'pick', debounced],
    queryFn: () => api.get<Paginated<Lead>>('/leads', { q: debounced || undefined, limit: 20, status: 'New,Contacted,Qualified,Site Visit,Negotiation' }),
    enabled: !lead,
  });

  const save = async () => {
    if (!leadId) return toast.error('Choose a lead');
    setBusy(true);
    try {
      const v = await api.post<SiteVisit>('/site-visits', { lead_id: leadId, property_id: propertyId || null, visit_date: date, visit_time: time });
      for (const k of ['site-visits', 'today', 'leads', 'followups']) void qc.invalidateQueries({ queryKey: [k] });
      toast.success('Site visit scheduled');
      onClose();
      navigate(`/site-visits/${v.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={lead ? `Site visit with ${lead.name}` : 'Schedule a site visit'}>
      {!lead && (
        <Field label="Lead">
          {(id) => (
            <div className="space-y-2">
              <input id={id} type="search" className="field" placeholder="Search your leads" value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} />
              <div className="max-h-48 divide-y divide-stone-100 overflow-y-auto rounded-xl border border-stone-200">
                {(leads.data?.data ?? []).map((l) => (
                  <label key={l.id} className="flex items-center gap-3 px-3 py-2.5 text-[14px]">
                    <input type="radio" name="visit-lead" className="size-4 accent-brand-800" checked={leadId === l.id} onChange={() => setLeadId(l.id)} />
                    <span className="flex-1 truncate font-medium">{l.name}</span>
                    <span className="text-[12px] text-stone-500">{l.status}</span>
                  </label>
                ))}
                {leads.data && !leads.data.data.length && <p className="px-3 py-3 text-[13px] text-stone-500">No open leads match.</p>}
                {leads.isPending && <p className="px-3 py-3 text-[13px] text-stone-500">Loading leads…</p>}
              </div>
            </div>
          )}
        </Field>
      )}
      <Field label="Property" hint="Optional. Only available and reserved units are listed.">
        {(id) => (
          <select id={id} className="field" value={propertyId} onChange={(e) => setPropertyId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Decide on site</option>
            {(properties.data?.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.project} {p.unit_number} · {inrShort(p.price)}
              </option>
            ))}
          </select>
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">{(id) => <input id={id} type="date" className="field" min={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label="Time">{(id) => <input id={id} type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
      </div>
      <Button block size="lg" onClick={save} loading={busy}>
        Schedule visit
      </Button>
    </Sheet>
  );
}
