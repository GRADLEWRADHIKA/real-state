import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck2 } from 'lucide-react';
import type { Followup, Paginated } from '@estateflow/shared';
import { api } from '@/lib/api';
import { canWrite, useUser } from '@/lib/session';
import { BellButton } from '@/components/shell';
import { Card, Empty, Loadable, Screen, Segmented } from '@/components/ui';
import { FollowupRow } from '@/components/followup';

type Bucket = 'today' | 'overdue' | 'upcoming' | 'week';
type Summary = { summary?: Partial<Record<Bucket, number>> };

export default function Followups() {
  const user = useUser();
  const [params, setParams] = useSearchParams();
  const bucket = (params.get('bucket') as Bucket) || 'today';
  const q = useQuery({ queryKey: ['followups', bucket], queryFn: () => api.get<Paginated<Followup, Summary>>('/followups', { bucket, limit: 100 }) });
  const s = q.data?.meta.summary ?? {};
  const label = (b: Bucket, text: string) => (s[b] !== undefined ? `${text} · ${s[b]}` : text);

  return (
    <Screen title="Follow-ups" actions={<BellButton />}>
      <Segmented
        value={bucket}
        onChange={(v) => setParams(v === 'today' ? {} : { bucket: v }, { replace: true })}
        options={[
          { value: 'today', label: label('today', 'Today') },
          { value: 'overdue', label: label('overdue', 'Overdue') },
          { value: 'upcoming', label: label('upcoming', 'Upcoming') },
          { value: 'week', label: 'This week' },
        ]}
      />
      <Loadable q={q}>
        {(d) =>
          d.data.length ? (
            <Card className="divide-y divide-stone-100">
              {d.data.map((f) => (
                <FollowupRow key={f.id} f={f} canEdit={canWrite(user)} />
              ))}
            </Card>
          ) : (
            <Empty icon={CalendarCheck2} title={bucket === 'overdue' ? 'Nothing overdue' : 'No follow-ups here'} body={bucket === 'overdue' ? 'You are on top of every lead.' : 'Schedule follow-ups from a lead.'} />
          )
        }
      </Loadable>
    </Screen>
  );
}
