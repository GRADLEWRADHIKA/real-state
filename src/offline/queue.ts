/**
 * Offline write queue. Field work (calls logged, notes, follow-ups completed, site check-ins) is
 * recorded on the device first when there is no connection and replayed, in order, once the
 * device is back online.
 *
 * Rules:
 * - Items replay strictly in the order they were recorded; a retryable failure stops the run so a
 *   check-out never reaches the server before its check-in.
 * - Network errors, timeouts, rate limits and 5xx responses are retried with exponential backoff.
 * - 401 is retried too (the session is refreshed or the user signs in again; the work is kept).
 * - Any other 4xx means the server will never accept the item (deleted lead, validation): it is
 *   dropped and reported through `onDrop` so the user sees what was not saved.
 */

export type QueueKind = 'log-contact' | 'note' | 'followup-complete' | 'check-in' | 'check-out' | 'lead-status' | 'lead-create' | 'visit-feedback';

export interface QueueItem {
  id: string;
  kind: QueueKind;
  method: 'POST' | 'PUT' | 'PATCH';
  path: string;
  body: Record<string, unknown>;
  /** Short human description, e.g. "Call logged for Megha Kapoor". */
  label: string;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
}

export interface QueueStore {
  load(): Promise<QueueItem[]>;
  save(items: QueueItem[]): Promise<void>;
}

export interface SendError {
  status: number;
  message: string;
}

export interface QueueOptions {
  store: QueueStore;
  send: (item: QueueItem) => Promise<void>;
  onChange?: (items: QueueItem[]) => void;
  onDrop?: (item: QueueItem, error: SendError) => void;
  onSent?: (item: QueueItem) => void;
  now?: () => number;
  id?: () => string;
  /** Base delay for the first retry (doubles each attempt). */
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export interface FlushResult {
  sent: number;
  dropped: number;
  remaining: number;
}

const RETRYABLE = new Set([0, 401, 408, 425, 429]);
export const isRetryable = (status: number) => RETRYABLE.has(status) || status >= 500;

function toSendError(err: unknown): SendError {
  if (err && typeof err === 'object' && 'status' in err && typeof (err as { status: unknown }).status === 'number') {
    return { status: (err as { status: number }).status, message: (err as { message?: string }).message ?? 'Request failed' };
  }
  return { status: 0, message: err instanceof Error ? err.message : 'Request failed' };
}

export class OfflineQueue {
  private items: QueueItem[] = [];
  private loaded: Promise<void> | null = null;
  private flushing: Promise<FlushResult> | null = null;
  private readonly now: () => number;
  private readonly newId: () => string;
  private readonly base: number;
  private readonly max: number;

  constructor(private readonly opts: QueueOptions) {
    this.now = opts.now ?? Date.now;
    this.newId = opts.id ?? (() => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
    this.base = opts.baseDelayMs ?? 2_000;
    this.max = opts.maxDelayMs ?? 5 * 60_000;
  }

  private ensureLoaded() {
    this.loaded ??= this.opts.store.load().then((items) => {
      this.items = Array.isArray(items) ? items : [];
    });
    return this.loaded;
  }

  private async persist() {
    await this.opts.store.save(this.items);
    this.opts.onChange?.([...this.items]);
  }

  async list() {
    await this.ensureLoaded();
    return [...this.items];
  }

  async size() {
    await this.ensureLoaded();
    return this.items.length;
  }

  async enqueue(item: Pick<QueueItem, 'kind' | 'method' | 'path' | 'body' | 'label'>): Promise<QueueItem> {
    await this.ensureLoaded();
    const full: QueueItem = { ...item, id: this.newId(), createdAt: this.now(), attempts: 0, nextAttemptAt: 0 };
    this.items.push(full);
    await this.persist();
    return full;
  }

  async remove(id: string) {
    await this.ensureLoaded();
    this.items = this.items.filter((i) => i.id !== id);
    await this.persist();
  }

  async clear() {
    await this.ensureLoaded();
    this.items = [];
    await this.persist();
  }

  /** Delay before the next attempt after `attempts` failures. */
  backoff(attempts: number) {
    return Math.min(this.max, this.base * 2 ** Math.max(0, attempts - 1));
  }

  /**
   * Replays due items in order. `force` ignores backoff timers (used when the device just came
   * back online or the user tapped "Sync now"). Concurrent calls share one run.
   */
  flush(force = false): Promise<FlushResult> {
    this.flushing ??= this.run(force).finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async run(force: boolean): Promise<FlushResult> {
    await this.ensureLoaded();
    let sent = 0;
    let dropped = 0;
    while (this.items.length) {
      const item = this.items[0];
      if (!force && item.nextAttemptAt > this.now()) break;
      try {
        await this.opts.send(item);
        this.items.shift();
        sent++;
        await this.persist();
        this.opts.onSent?.(item);
      } catch (err) {
        const e = toSendError(err);
        if (isRetryable(e.status)) {
          item.attempts++;
          item.lastError = e.message;
          item.nextAttemptAt = this.now() + this.backoff(item.attempts);
          await this.persist();
          break;
        }
        this.items.shift();
        dropped++;
        await this.persist();
        this.opts.onDrop?.(item, e);
      }
    }
    return { sent, dropped, remaining: this.items.length };
  }
}
