import { describe, expect, it } from 'vitest';
import { OfflineQueue, isRetryable, type QueueItem, type QueueStore } from '../src/offline/queue';

function memoryStore(initial: QueueItem[] = []) {
  let data = structuredClone(initial);
  const store: QueueStore & { data: () => QueueItem[] } = {
    load: async () => structuredClone(data),
    save: async (items) => {
      data = structuredClone(items);
    },
    data: () => data,
  };
  return store;
}

const err = (status: number, message = `HTTP ${status}`) => Object.assign(new Error(message), { status });

const item = (label: string, kind: QueueItem['kind'] = 'note') => ({ kind, method: 'POST' as const, path: `/leads/1/notes`, body: { note: label }, label });

function setup(send: (i: QueueItem) => Promise<void>, initial?: QueueItem[]) {
  let clock = 1_000_000;
  let n = 0;
  const dropped: string[] = [];
  const changes: number[] = [];
  const store = memoryStore(initial);
  const q = new OfflineQueue({
    store,
    send,
    now: () => clock,
    id: () => `id-${++n}`,
    baseDelayMs: 1000,
    maxDelayMs: 8000,
    onDrop: (i) => dropped.push(i.label),
    onChange: (items) => changes.push(items.length),
  });
  return { q, store, dropped, changes, tick: (ms: number) => (clock += ms), now: () => clock };
}

describe('OfflineQueue', () => {
  it('replays items in the order they were recorded', async () => {
    const seen: string[] = [];
    const { q, store } = setup(async (i) => void seen.push(i.label));
    await q.enqueue(item('check in', 'check-in'));
    await q.enqueue(item('check out', 'check-out'));
    await q.enqueue(item('note'));
    const r = await q.flush();
    expect(r).toEqual({ sent: 3, dropped: 0, remaining: 0 });
    expect(seen).toEqual(['check in', 'check out', 'note']);
    expect(store.data()).toEqual([]);
  });

  it('persists items so they survive an app restart', async () => {
    const first = setup(async () => {
      throw err(0);
    });
    await first.q.enqueue(item('call logged', 'log-contact'));
    const saved = first.store.data();
    expect(saved).toHaveLength(1);

    const seen: string[] = [];
    const second = setup(async (i) => void seen.push(i.label), saved);
    expect(await second.q.size()).toBe(1);
    await second.q.flush();
    expect(seen).toEqual(['call logged']);
  });

  it('stops at a network failure and keeps the order intact', async () => {
    let online = false;
    const seen: string[] = [];
    const { q } = setup(async (i) => {
      if (!online) throw err(0, 'offline');
      seen.push(i.label);
    });
    await q.enqueue(item('a'));
    await q.enqueue(item('b'));
    const r1 = await q.flush(true);
    expect(r1).toEqual({ sent: 0, dropped: 0, remaining: 2 });
    const [head] = await q.list();
    expect(head.attempts).toBe(1);
    expect(head.lastError).toBe('offline');
    online = true;
    const r2 = await q.flush(true);
    expect(r2.sent).toBe(2);
    expect(seen).toEqual(['a', 'b']);
  });

  it('backs off exponentially between automatic retries', async () => {
    let calls = 0;
    const { q, tick } = setup(async () => {
      calls++;
      throw err(503);
    });
    await q.enqueue(item('a'));
    await q.flush();
    expect(calls).toBe(1);
    await q.flush(); // not due yet
    expect(calls).toBe(1);
    tick(1000);
    await q.flush();
    expect(calls).toBe(2);
    tick(1000); // second retry waits 2s
    await q.flush();
    expect(calls).toBe(2);
    tick(1000);
    await q.flush();
    expect(calls).toBe(3);
    expect(q.backoff(10)).toBe(8000);
  });

  it('drops items the server rejects and carries on with the rest', async () => {
    const seen: string[] = [];
    const { q, dropped } = setup(async (i) => {
      if (i.label === 'bad') throw err(422, 'note: cannot be empty');
      seen.push(i.label);
    });
    await q.enqueue(item('ok 1'));
    await q.enqueue(item('bad'));
    await q.enqueue(item('ok 2'));
    const r = await q.flush();
    expect(r).toEqual({ sent: 2, dropped: 1, remaining: 0 });
    expect(dropped).toEqual(['bad']);
    expect(seen).toEqual(['ok 1', 'ok 2']);
  });

  it('keeps work when the session expired (401) so it can be sent after signing in', async () => {
    const { q } = setup(async () => {
      throw err(401);
    });
    await q.enqueue(item('a'));
    const r = await q.flush(true);
    expect(r.remaining).toBe(1);
  });

  it('shares one run between concurrent flushes', async () => {
    let calls = 0;
    const { q } = setup(async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 5));
    });
    await q.enqueue(item('a'));
    await Promise.all([q.flush(), q.flush(), q.flush()]);
    expect(calls).toBe(1);
  });

  it('reports the pending count on every change', async () => {
    const { q, changes } = setup(async () => undefined);
    await q.enqueue(item('a'));
    await q.enqueue(item('b'));
    await q.flush();
    expect(changes).toEqual([1, 2, 1, 0]);
  });

  it('classifies errors', () => {
    for (const s of [0, 401, 408, 429, 500, 502, 503]) expect(isRetryable(s)).toBe(true);
    for (const s of [400, 403, 404, 409, 410, 413, 415, 422]) expect(isRetryable(s)).toBe(false);
  });
});
