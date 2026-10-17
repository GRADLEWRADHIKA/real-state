import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, isNetworkError } from '@/lib/api';
import { kv } from '@/lib/platform';
import { isOnline, subscribeOnline } from '@/lib/network';
import { OfflineQueue, type QueueItem } from './queue';

/** One queue per person, so nothing recorded by one user is ever replayed under another's sign-in. */
export const queueKey = (userId: number) => `ef_offline_queue:${userId}`;

/** Query-key prefixes to refetch after each kind of queued write reaches the server. */
const AFFECTS: Record<QueueItem['kind'], string[]> = {
  'log-contact': ['leads', 'today'],
  note: ['leads'],
  'followup-complete': ['followups', 'leads', 'today'],
  'check-in': ['site-visits', 'leads', 'today'],
  'check-out': ['site-visits', 'leads', 'today'],
  'lead-status': ['leads'],
  'lead-create': ['leads'],
};

export type QueuedSpec = Pick<QueueItem, 'kind' | 'method' | 'path' | 'body' | 'label'>;
export type SubmitResult<T> = { state: 'sent'; data: T } | { state: 'queued' };

interface OfflineCtx {
  pending: QueueItem[];
  /** Sends now when online, otherwise (or when the network drops mid-request) saves it for later. */
  submit: <T = unknown>(spec: QueuedSpec) => Promise<SubmitResult<T>>;
  syncNow: () => Promise<void>;
  discard: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

const Ctx = createContext<OfflineCtx | null>(null);

function sendItem<T = unknown>(item: QueueItem): Promise<T> {
  if (item.method === 'POST') return api.post(item.path, item.body);
  if (item.method === 'PUT') return api.put(item.path, item.body);
  return api.patch(item.path, item.body);
}

export function OfflineProvider({ userId, children }: { userId: number; children: ReactNode }) {
  const qc = useQueryClient();
  const [pending, setPending] = useState<QueueItem[]>([]);

  const queue = useMemo(
    () =>
      new OfflineQueue({
        store: {
          load: async () => JSON.parse((await kv.get(queueKey(userId))) || '[]'),
          save: (items) => kv.set(queueKey(userId), JSON.stringify(items)),
        },
        send: async (item) => {
          await sendItem(item);
        },
        onChange: setPending,
        onSent: (item) => AFFECTS[item.kind].forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
        onDrop: (item, e) => toast.error(`Not saved: ${item.label}`, { description: e.message, duration: 10_000 }),
      }),
    [qc, userId],
  );

  useEffect(() => {
    void queue.list().then(setPending);
    const flush = (force: boolean) =>
      void queue.flush(force).then((r) => {
        if (r.sent) toast.success(`${r.sent} offline change${r.sent > 1 ? 's' : ''} synced`);
      });
    if (isOnline()) flush(true);
    const unsub = subscribeOnline(() => isOnline() && flush(true));
    const timer = setInterval(() => isOnline() && flush(false), 15_000);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, [queue]);

  const value = useMemo<OfflineCtx>(
    () => ({
      pending,
      async submit<T>(spec: QueuedSpec): Promise<SubmitResult<T>> {
        // Anything already waiting goes first so the server sees events in the order they happened.
        if (isOnline() && (await queue.size()) === 0) {
          try {
            const data = await sendItem<T>({ ...spec, id: 'direct', createdAt: Date.now(), attempts: 0, nextAttemptAt: 0 });
            AFFECTS[spec.kind].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
            return { state: 'sent', data };
          } catch (err) {
            if (!isNetworkError(err)) throw err;
          }
        }
        await queue.enqueue(spec);
        if (isOnline()) void queue.flush(true);
        toast('Saved on this phone', { description: 'It will sync automatically when you are back online.' });
        return { state: 'queued' };
      },
      async syncNow() {
        const r = await queue.flush(true);
        if (r.remaining) toast.error(`${r.remaining} change${r.remaining > 1 ? 's are' : ' is'} still waiting for a connection`);
        else toast.success('Everything is synced');
      },
      discard: (id) => queue.remove(id),
      clearAll: () => queue.clear(),
    }),
    [pending, queue, qc],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOffline() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useOffline outside OfflineProvider');
  return v;
}
