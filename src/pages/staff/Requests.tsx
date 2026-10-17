import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Inbox } from 'lucide-react';
import { CUSTOMER_REQUEST_STATUSES, fmtDate, timeAgo, type CustomerRequest, type CustomerRequestStatus, type Paginated } from '@estateflow/shared';
import { api, errorMessage } from '@/lib/api';
import { BellButton } from '@/components/shell';
import { Badge, Button, Card, Empty, Field, Loadable, Screen, Segmented, Sheet, StatusBadge } from '@/components/ui';
import { CallChip } from '@/components/contact';

export function RequestCard({ r, onRespond }: { r: CustomerRequest; onRespond?: () => void }) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge>{r.type}</Badge>
            <StatusBadge status={r.status} />
          </div>
          <p className="mt-1.5 font-semibold">{r.subject}</p>
          {r.customer_name && (
            <Link to={`/customers/${r.customer_id}?tab=requests`} className="text-[13px] font-medium text-brand-800">
              {r.customer_name}
              {r.customer_code ? ` · ${r.customer_code}` : ''}
            </Link>
          )}
        </div>
        {r.customer_phone && <CallChip phone={r.customer_phone} name={r.customer_name ?? 'customer'} />}
      </div>
      {r.message && <p className="mt-2 text-[14px] whitespace-pre-line text-stone-700">{r.message}</p>}
      {r.preferred_date && <p className="mt-1 text-[13px] text-stone-500">Preferred date: {fmtDate(r.preferred_date)}</p>}
      <p className="mt-1 text-[12px] text-stone-400">Raised {timeAgo(r.created_at)}</p>
      {r.response && (
        <div className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-[14px] text-brand-900">
          <p className="text-[12px] font-semibold text-brand-700">{r.handled_by_name ? `Reply from ${r.handled_by_name}` : 'Reply'}</p>
          <p className="whitespace-pre-line">{r.response}</p>
        </div>
      )}
      {onRespond && (
        <Button size="sm" variant="secondary" className="mt-3" onClick={onRespond}>
          {r.response ? 'Update reply' : 'Reply'}
        </Button>
      )}
    </Card>
  );
}

type Counts = { statusCounts?: { status: string; n: number }[] };

export default function StaffRequests() {
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as CustomerRequestStatus | null) ?? 'Open';
  const [responding, setResponding] = useState<CustomerRequest | null>(null);
  const q = useQuery({ queryKey: ['customer-requests', status], queryFn: () => api.get<Paginated<CustomerRequest, Counts>>('/customer-requests', { status, limit: 100 }) });
  const counts = Object.fromEntries((q.data?.meta.statusCounts ?? []).map((c) => [c.status, c.n]));

  return (
    <Screen title="Customer requests" actions={<BellButton />}>
      <Segmented
        value={status}
        onChange={(v) => setParams(v === 'Open' ? {} : { status: v }, { replace: true })}
        options={CUSTOMER_REQUEST_STATUSES.map((s) => ({ value: s, label: counts[s] ? `${s} · ${counts[s]}` : s }))}
      />
      <Loadable q={q}>
        {(d) =>
          d.data.length ? (
            <div className="space-y-2">
              {d.data.map((r) => (
                <RequestCard key={r.id} r={r} onRespond={() => setResponding(r)} />
              ))}
            </div>
          ) : (
            <Empty icon={Inbox} title={`No ${status.toLowerCase()} requests`} body="Requests customers raise from their app arrive here." />
          )
        }
      </Loadable>
      {responding && <RespondSheet r={responding} onClose={() => setResponding(null)} />}
    </Screen>
  );
}

function RespondSheet({ r, onClose }: { r: CustomerRequest; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<CustomerRequestStatus>(r.status === 'Open' ? 'In Progress' : r.status);
  const [response, setResponse] = useState(r.response ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/customer-requests/${r.id}`, { status, response: response.trim() || null });
      void qc.invalidateQueries({ queryKey: ['customer-requests'] });
      void qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Reply sent to the customer');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title={r.subject}>
      <Segmented value={status} onChange={setStatus} options={CUSTOMER_REQUEST_STATUSES.map((s) => ({ value: s, label: s }))} />
      <Field label="Reply to customer" hint="The customer sees this in their app.">
        {(id) => <textarea id={id} rows={4} className="field" value={response} onChange={(e) => setResponse(e.target.value)} />}
      </Field>
      <Button block onClick={save} loading={busy}>
        Save
      </Button>
    </Sheet>
  );
}
