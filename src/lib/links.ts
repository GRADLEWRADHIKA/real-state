import type { User } from '@estateflow/shared';

/** Server links are written for every client; map the few that differ in the app. */
export function appLink(link: string, role: User['role']) {
  if (role === 'customer') {
    if (link === '/' || link === '/property') return '/home';
    const receipt = /^\/receipts\/(\d+)/.exec(link);
    if (receipt) return `/payments?receipt=${receipt[1]}`;
    return link;
  }
  if (link.startsWith('/users')) return '/more';
  return link;
}

/** Server resource name → app query-key prefixes to refetch. */
const KEYS: Record<string, string[]> = {
  leads: ['leads', 'today'],
  'site-visits': ['site-visits', 'today', 'leads'],
  followups: ['followups', 'today', 'leads'],
  tasks: ['tasks', 'today'],
  customers: ['customers'],
  deals: ['customers'],
  finance: ['customers', 'today', 'portal'],
  documents: ['documents', 'portal', 'customers', 'site-visits'],
  notifications: ['notifications'],
  'customer-requests': ['customer-requests', 'customers'],
  portal: ['portal'],
  properties: ['properties', 'portal'],
  users: ['directory'],
  settings: ['settings'],
};

export const keysFor = (resources: string[] = []) => [...new Set(resources.flatMap((r) => KEYS[r] ?? [r]))];
