import { NavLink, Outlet, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Bell, CloudOff, RefreshCw, type LucideIcon } from 'lucide-react';
import type { NotificationItem, Paginated } from '@estateflow/shared';
import { api } from '@/lib/api';
import { useOnline } from '@/lib/network';
import { useOffline } from '@/offline/OfflineProvider';
import { IconButton } from './ui';

export interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export function useNotifications() {
  return useQuery({ queryKey: ['notifications'], queryFn: () => api.get<Paginated<NotificationItem, { unread: number }>>('/notifications', { limit: 50 }) });
}

export function BellButton() {
  const navigate = useNavigate();
  const unread = useNotifications().data?.meta.unread ?? 0;
  return <IconButton icon={Bell} label={unread ? `Notifications, ${unread} unread` : 'Notifications'} badge={unread} onClick={() => navigate('/notifications')} />;
}

/** Offline strip + pending-changes count, shown above the bottom bar. */
function SyncStrip() {
  const online = useOnline();
  const { pending, syncNow } = useOffline();
  if (online && !pending.length) return null;
  return (
    <div role="status" className={clsx('flex items-center gap-2 px-4 py-2 text-[13px] font-medium', online ? 'bg-gold-100 text-gold-600' : 'bg-stone-800 text-white')}>
      {!online && <CloudOff className="size-4 shrink-0" />}
      <span className="flex-1">
        {online ? 'Syncing changes made offline' : 'Offline. Showing saved data.'}
        {pending.length > 0 && (
          <>
            {' '}
            <span data-testid="pending-count" className="num font-bold">
              {pending.length}
            </span>{' '}
            waiting to sync
          </>
        )}
      </span>
      {online && pending.length > 0 && (
        <button type="button" onClick={() => void syncNow()} className="inline-flex items-center gap-1 font-semibold">
          <RefreshCw className="size-3.5" /> Sync
        </button>
      )}
    </div>
  );
}

export function TabShell({ tabs }: { tabs: Tab[] }) {
  return (
    <div className="min-h-dvh">
      <Outlet />
      <div className="fixed inset-x-0 bottom-0 z-30">
        <SyncStrip />
        <nav aria-label="Main" className="safe-bottom border-t border-stone-200 bg-white">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) => clsx('relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold', isActive ? 'text-brand-900' : 'text-stone-500')}
              >
                {({ isActive }) => (
                  <>
                    <span className={clsx('grid h-7 w-14 place-items-center rounded-full transition-colors', isActive && 'bg-brand-100')}>
                      <t.icon className="size-[21px]" strokeWidth={isActive ? 2.4 : 2} />
                    </span>
                    {t.label}
                    {!!t.badge && <span className="num absolute top-2 left-1/2 ml-2 rounded-full bg-red-600 px-1.5 text-[10px] leading-4 font-bold text-white">{t.badge > 99 ? '99+' : t.badge}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
