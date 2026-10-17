import { fmtTime } from '@estateflow/shared';
import { isNative, kv } from './platform';

/**
 * On-device reminders for today's follow-ups and site visits (Android local notifications; no push
 * service). They are rebuilt from the latest "My day" data whenever it changes.
 */
const PREF = 'ef_reminders';
const LEAD_MINUTES = 15;
const FOLLOWUP_BASE = 100_000;
const VISIT_BASE = 200_000;

export interface ReminderSource {
  followups: { id: number; due_date: string; due_time: string; type: string; lead_name: string; lead_id: number; status: string }[];
  visits: { id: number; visit_date: string; visit_time: string; lead_name: string; status: string; property_project?: string | null; property_unit?: string | null }[];
}

export interface PlannedReminder {
  id: number;
  title: string;
  body: string;
  at: Date;
  link: string;
}

/** Pure planning step (unit-tested): what should fire, and when. */
export function planReminders(src: ReminderSource, now = new Date(), leadMinutes = LEAD_MINUTES): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  const at = (date: string, time: string) => new Date(new Date(`${date}T${time || '09:00'}:00`).getTime() - leadMinutes * 60_000);
  for (const f of src.followups) {
    if (f.status !== 'Pending') continue;
    const when = at(f.due_date, f.due_time);
    if (when > now) out.push({ id: FOLLOWUP_BASE + f.id, title: `${f.type} at ${fmtTime(f.due_time)}`, body: `Follow up with ${f.lead_name}`, at: when, link: `/leads/${f.lead_id}` });
  }
  for (const v of src.visits) {
    if (v.status !== 'Scheduled' && v.status !== 'Rescheduled') continue;
    const when = at(v.visit_date, v.visit_time);
    const where = v.property_project ? ` · ${v.property_project} ${v.property_unit ?? ''}`.trimEnd() : '';
    if (when > now) out.push({ id: VISIT_BASE + v.id, title: `Site visit at ${fmtTime(v.visit_time)}`, body: `${v.lead_name}${where}`, at: when, link: `/site-visits/${v.id}` });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export const remindersSupported = isNative;
export const remindersOn = async () => (await kv.get(PREF)) === '1';

export async function enableReminders(): Promise<boolean> {
  if (!isNative) return false;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const p = await LocalNotifications.requestPermissions();
  if (p.display !== 'granted') return false;
  await kv.set(PREF, '1');
  return true;
}

export async function disableReminders() {
  await kv.remove(PREF);
  if (!isNative) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
}

export async function syncReminders(src: ReminderSource) {
  if (!isNative || !(await remindersOn())) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter((n) => n.id >= FOLLOWUP_BASE);
  if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
  const plan = planReminders(src);
  if (!plan.length) return;
  await LocalNotifications.schedule({
    notifications: plan.map((p) => ({ id: p.id, title: p.title, body: p.body, schedule: { at: p.at, allowWhileIdle: true }, extra: { link: p.link } })),
  });
}

/** Opens the record behind a tapped reminder. */
export async function listenForReminderTaps(open: (link: string) => void) {
  if (!isNative) return () => undefined;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const h = await LocalNotifications.addListener('localNotificationActionPerformed', (a) => {
    const link = a.notification.extra?.link;
    if (typeof link === 'string') open(link);
  });
  return () => void h.remove();
}
