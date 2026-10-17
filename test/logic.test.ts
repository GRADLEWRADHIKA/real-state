import { describe, expect, it } from 'vitest';
import { planReminders, type ReminderSource } from '../src/lib/reminders';
import { appLink, keysFor } from '../src/lib/links';

const followup = (over: Partial<ReminderSource['followups'][number]> = {}) => ({ id: 1, due_date: '2026-10-17', due_time: '15:00', type: 'Call', lead_name: 'Megha Kapoor', lead_id: 7, status: 'Pending', ...over });
const visit = (over: Partial<ReminderSource['visits'][number]> = {}) => ({ id: 3, visit_date: '2026-10-17', visit_time: '11:30', lead_name: 'Megha Kapoor', status: 'Scheduled', property_project: 'Starwiz Villas', property_unit: 'V-12', ...over });

describe('planReminders', () => {
  const now = new Date('2026-10-17T09:00:00');

  it('fires 15 minutes before each pending follow-up and open visit, in time order', () => {
    const plan = planReminders({ followups: [followup()], visits: [visit()] }, now);
    expect(plan.map((p) => p.id)).toEqual([200_003, 100_001]);
    expect(plan[0]).toMatchObject({ title: 'Site visit at 11:30 AM', body: 'Megha Kapoor · Starwiz Villas V-12', link: '/site-visits/3' });
    expect(plan[0]!.at.getTime()).toBe(new Date('2026-10-17T11:15:00').getTime());
    expect(plan[1]).toMatchObject({ body: 'Follow up with Megha Kapoor', link: '/leads/7' });
  });

  it('skips anything already past, completed or cancelled', () => {
    const plan = planReminders(
      {
        followups: [followup({ due_time: '09:10' }), followup({ id: 2, status: 'Completed' }), followup({ id: 4, due_date: '2026-10-16' })],
        visits: [visit({ status: 'Completed' }), visit({ id: 5, status: 'Cancelled' }), visit({ id: 6, status: 'Rescheduled', visit_time: '18:00' })],
      },
      now,
    );
    expect(plan.map((p) => p.id)).toEqual([200_006]);
  });

  it('defaults a missing time to 9 AM and omits an unknown property', () => {
    const plan = planReminders({ followups: [], visits: [visit({ visit_time: '', property_project: null })] }, new Date('2026-10-17T06:00:00'));
    expect(plan[0]!.body).toBe('Megha Kapoor');
    expect(plan[0]!.at.getTime()).toBe(new Date('2026-10-17T08:45:00').getTime());
  });
});

describe('keysFor', () => {
  it('maps server resources to the query keys that show them, without duplicates', () => {
    expect(keysFor(['site-visits', 'followups'])).toEqual(['site-visits', 'today', 'leads', 'followups']);
    expect(keysFor(['finance'])).toContain('portal');
    expect(keysFor(['something-new'])).toEqual(['something-new']);
    expect(keysFor()).toEqual([]);
  });
});

describe('appLink', () => {
  it('maps dashboard-shaped links to app screens', () => {
    expect(appLink('/receipts/42', 'customer')).toBe('/payments?receipt=42');
    expect(appLink('/', 'customer')).toBe('/home');
    expect(appLink('/property', 'customer')).toBe('/home');
    expect(appLink('/payments', 'customer')).toBe('/payments');
    expect(appLink('/users?tab=resets&request=3', 'admin')).toBe('/more');
    expect(appLink('/followups?bucket=overdue', 'sales')).toBe('/followups?bucket=overdue');
  });
});
