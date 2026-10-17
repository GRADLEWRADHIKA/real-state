import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, MapPinned } from 'lucide-react';
import { fmtDateShort, fmtTime, relativeDay, type Paginated, type SiteVisit } from '@estateflow/shared';
import { api } from '@/lib/api';
import { canWrite, useUser } from '@/lib/session';
import { BellButton } from '@/components/shell';
import { Badge, Button, Card, Empty, IconButton, Loadable, Screen, Segmented, StatusBadge } from '@/components/ui';
import { CallChip } from '@/components/contact';
import { ScheduleVisitSheet } from '@/components/visit';

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'week', label: 'This week' },
  { value: 'past', label: 'Past' },
] as const;
type Range = (typeof RANGES)[number]['value'];

export default function Visits() {
  const user = useUser();
  const editable = canWrite(user);
  const [params, setParams] = useSearchParams();
  const range = (params.get('range') as Range) || 'today';
  const [scheduling, setScheduling] = useState(false);
  const q = useQuery({ queryKey: ['site-visits', 'list', range], queryFn: () => api.get<Paginated<SiteVisit>>('/site-visits', { range, limit: 100 }) });

  return (
    <Screen
      title="Site visits"
      actions={
        <>
          {editable && <IconButton icon={CalendarPlus} label="Schedule a visit" onClick={() => setScheduling(true)} />}
          <BellButton />
        </>
      }
    >
      <Segmented value={range} onChange={(v) => setParams(v === 'today' ? {} : { range: v }, { replace: true })} options={RANGES.map((r) => ({ ...r }))} />
      <Loadable q={q}>
        {(d) =>
          d.data.length ? (
            <Card className="divide-y divide-stone-100">
              {d.data.map((v) => (
                <div key={v.id} className="flex items-center gap-3 px-4 py-3">
                  <Link to={`/site-visits/${v.id}`} className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{v.lead_name}</p>
                      {v.checked_in_at && !v.checked_out_at ? <Badge tone="gold">On site</Badge> : <StatusBadge status={v.status} />}
                    </div>
                    <p className="num text-[13px] text-stone-500">
                      {range === 'today' ? 'Today' : `${relativeDay(v.visit_date)} · ${fmtDateShort(v.visit_date)}`} · {fmtTime(v.visit_time)}
                    </p>
                    <p className="truncate text-[13px] text-stone-500">
                      {v.property_project ? `${v.property_project} ${v.property_unit ?? ''}` : 'Property to be decided'}
                      {user.role !== 'sales' && v.agent_name ? ` · ${v.agent_name}` : ''}
                    </p>
                  </Link>
                  <CallChip phone={v.lead_phone} leadId={editable ? v.lead_id : undefined} name={v.lead_name} />
                </div>
              ))}
            </Card>
          ) : (
            <Empty
              icon={MapPinned}
              title={range === 'past' ? 'No past visits' : 'No visits scheduled'}
              body={range === 'today' ? 'Nothing booked for today.' : undefined}
              action={editable && range !== 'past' && <Button icon={CalendarPlus} onClick={() => setScheduling(true)}>Schedule a visit</Button>}
            />
          )
        }
      </Loadable>
      {scheduling && <ScheduleVisitSheet onClose={() => setScheduling(false)} />}
    </Screen>
  );
}
