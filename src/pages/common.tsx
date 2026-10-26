import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { BellOff, BellRing, Building2, CalendarCheck2, HandCoins, IndianRupee, Wallet, CheckCheck, CloudUpload, Fingerprint, FolderLock, Inbox, KeyRound, ListChecks, LogOut, MonitorSmartphone, Server, Trash2, UserRound, Users, type LucideIcon } from 'lucide-react';
import { APP_VERSION, ROLE_LABEL, timeAgo, type NotificationItem, type User } from '@estateflow/shared';
import { api, auth, errorMessage, getServerUrl } from '@/lib/api';
import { useSession, useUser } from '@/lib/session';
import { biometricAvailable, biometricEnabled, setBiometricEnabled } from '@/lib/biometric';
import { disableReminders, enableReminders, remindersOn, remindersSupported } from '@/lib/reminders';
import { useOffline } from '@/offline/OfflineProvider';
import { useNotifications } from '@/components/shell';
import { Avatar, Button, Card, Empty, Field, IconButton, Loadable, RowLink, Screen, Section, Sheet } from '@/components/ui';
import { ServerSheet } from './auth';
import { appLink } from '@/lib/links';
import { canBrokers, canFinance, canStaff, canTargets } from './staff/Office';
import { canPrivateDocs } from './staff/PrivateDocs';

// ─── Notifications ─────────────────────────────────────────────────────────

export function Notifications() {
  const user = useUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useNotifications();
  const unread = q.data?.meta.unread ?? 0;

  const markRead = async (n: NotificationItem) => {
    if (!n.is_read) {
      await api.patch(`/notifications/${n.id}/read`, {}).catch(() => undefined);
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    }
    if (n.link) navigate(appLink(n.link, user.role));
  };
  const readAll = async () => {
    try {
      await api.post('/notifications/read-all');
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <Screen title="Notifications" subtitle={unread ? `${unread} unread` : undefined} back={user.role === 'customer' ? '/home' : '/today'} actions={unread > 0 && <IconButton icon={CheckCheck} label="Mark all as read" onClick={() => void readAll()} />}>
      <Loadable q={q}>
        {(d) =>
          d.data.length ? (
            <Card className="divide-y divide-stone-100">
              {d.data.map((n) => (
                <button key={n.id} type="button" onClick={() => void markRead(n)} className={clsx('flex w-full gap-3 px-4 py-3 text-left active:bg-stone-50', !n.is_read && 'bg-brand-50/60')}>
                  <span className={clsx('mt-1.5 size-2 shrink-0 rounded-full', n.is_read ? 'bg-transparent' : 'bg-brand-700')} />
                  <span className="min-w-0 flex-1">
                    <span className={clsx('block text-[14px]', !n.is_read && 'font-semibold')}>{n.title}</span>
                    <span className="block text-[13px] text-stone-600">{n.message}</span>
                    <span className="block text-[12px] text-stone-400">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              ))}
            </Card>
          ) : (
            <Empty icon={BellOff} title="No notifications" body="Updates about your work show up here." />
          )
        }
      </Loadable>
    </Screen>
  );
}

// ─── More (staff) ──────────────────────────────────────────────────────────

function MenuRow({ to, icon: Icon, label, detail }: { to: string; icon: LucideIcon; label: string; detail?: string }) {
  return (
    <RowLink to={to}>
      <span className="flex items-center gap-3">
        <Icon className="size-5 text-brand-700" />
        <span className="flex-1">
          <span className="block font-semibold">{label}</span>
          {detail && <span className="block text-[13px] text-stone-500">{detail}</span>}
        </span>
      </span>
    </RowLink>
  );
}

export function More() {
  const user = useUser();
  const { pending } = useOffline();
  const accounts = user.role === 'accounts';
  return (
    <Screen title="More">
      <Card>
        <RowLink to="/profile">
          <span className="flex items-center gap-3">
            <Avatar name={user.name} />
            <span>
              <span className="block font-semibold">{user.name}</span>
              <span className="block text-[13px] text-stone-500">
                {user.title || ROLE_LABEL[user.role]} · {user.email}
              </span>
            </span>
          </span>
        </RowLink>
      </Card>
      <Card className="divide-y divide-stone-100">
        {!accounts && <MenuRow to="/customers" icon={Users} label="Customers" detail="Bookings, payments and documents" />}
        {!accounts && <MenuRow to="/requests" icon={Inbox} label="Customer requests" detail="Visits, queries and complaints from the customer app" />}
 {canFinance(user) && <MenuRow to="/finance" icon={IndianRupee} label="Finance" detail="Installments due, record payments, receipts" />}
        {canFinance(user) && <MenuRow to="/expenses" icon={Wallet} label="Expenses" detail="Office and site spending" />}
        {canPrivateDocs(user) && <MenuRow to="/my-documents" icon={FolderLock} label="My documents" detail="Office and personal papers: upload or scan" />}
        {canBrokers(user) && <MenuRow to="/brokers" icon={HandCoins} label={canFinance(user) ? 'Broker commissions' : 'Brokers'} detail={canFinance(user) ? 'Commission due and paid' : 'Channel partners'} />}
        {canStaff(user) && <MenuRow to="/staff" icon={CalendarCheck2} label="Staff" detail={[ 'Attendance', canFinance(user) && 'salary', canTargets(user) && 'targets'].filter(Boolean).join(', ')} />}
        <MenuRow to="/properties" icon={Building2} label="Properties" detail="Inventory with photos to share with buyers" />
        <MenuRow to="/tasks" icon={ListChecks} label="My tasks" />
        <MenuRow to="/notifications" icon={BellRing} label="Notifications" />
        <MenuRow to="/profile" icon={UserRound} label="Profile and settings" detail={pending.length ? `${pending.length} change${pending.length > 1 ? 's' : ''} waiting to sync` : undefined} />
      </Card>
    </Screen>
  );
}

// ─── Profile ───────────────────────────────────────────────────────────────

function Toggle({ icon: Icon, label, detail, checked, onChange }: { icon: LucideIcon; label: string; detail: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 px-4 py-3.5">
      <Icon className="size-5 shrink-0 text-brand-700" />
      <span className="flex-1">
        <span className="block font-semibold">{label}</span>
        <span className="block text-[13px] text-stone-500">{detail}</span>
      </span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="relative h-7 w-12 shrink-0 rounded-full bg-stone-300 transition-colors peer-checked:bg-brand-700 after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  );
}

export function Profile() {
  const user = useUser();
  const { logout, recheckServer } = useSession();
  const { pending, syncNow, discard } = useOffline();
  const [sheet, setSheet] = useState<'edit' | 'password' | 'server' | 'signout' | null>(null);
  const [bio, setBio] = useState({ available: false, on: false });
  const [reminders, setReminders] = useState(false);

  useEffect(() => {
    void Promise.all([biometricAvailable(), biometricEnabled(), remindersOn()]).then(([available, on, r]) => {
      setBio({ available, on });
      setReminders(r);
    });
  }, []);

  return (
    <Screen title="Profile" back={user.role === 'customer' ? '/home' : '/more'}>
      <Card className="flex items-center gap-3 p-4">
        <Avatar name={user.name} className="size-14 text-[17px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[19px] font-semibold text-brand-950">{user.name}</p>
          <p className="truncate text-[13px] text-stone-500">{user.email}</p>
          <p className="text-[13px] text-stone-500">
            {user.role === 'customer' ? user.customer_name ?? 'Customer' : user.title || ROLE_LABEL[user.role]}
            {user.phone ? ` · ${user.phone}` : ''}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setSheet('edit')}>
          Edit
        </Button>
      </Card>

      {pending.length > 0 && (
        <Section title="Waiting to sync" action={<Button size="sm" variant="ghost" icon={CloudUpload} onClick={() => void syncNow()}>Sync now</Button>}>
          <Card className="divide-y divide-stone-100">
            {pending.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{p.label}</p>
                  <p className="text-[12px] text-stone-500">
                    Saved {timeAgo(new Date(p.createdAt).toISOString())}
                    {p.lastError ? ` · ${p.lastError}` : ''}
                  </p>
                </div>
                <IconButton icon={Trash2} label={`Discard ${p.label}`} onClick={() => void discard(p.id).then(() => toast('Discarded'))} />
              </div>
            ))}
          </Card>
        </Section>
      )}

      <Section title="Security">
        <Card className="divide-y divide-stone-100">
          <button type="button" onClick={() => setSheet('password')} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-stone-50">
            <KeyRound className="size-5 text-brand-700" />
            <span className="flex-1 font-semibold">Change password</span>
          </button>
          {bio.available && (
            <Toggle
              icon={Fingerprint}
              label="Fingerprint unlock"
              detail="Ask for your fingerprint or face when the app opens"
              checked={bio.on}
              onChange={async (on) => {
                const ok = await setBiometricEnabled(on);
                if (ok) setBio({ ...bio, on });
                else toast.error('Fingerprint was not confirmed');
              }}
            />
          )}
          {remindersSupported && (
            <Toggle
              icon={BellRing}
              label="Reminders on this phone"
              detail="15 minutes before follow-ups and site visits"
              checked={reminders}
              onChange={async (on) => {
                if (on) {
                  const ok = await enableReminders();
                  setReminders(ok);
                  if (!ok) toast.error('Allow notifications for EstateFlow in Android settings to get reminders.');
                } else {
                  await disableReminders();
                  setReminders(false);
                }
              }}
            />
          )}
        </Card>
      </Section>

      <Section title="App">
        <Card className="divide-y divide-stone-100">
          <button type="button" onClick={() => setSheet('server')} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-stone-50">
            <Server className="size-5 text-brand-700" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Server</span>
              <span className="block truncate text-[13px] text-stone-500">{getServerUrl() || window.location.origin}</span>
            </span>
          </button>
          <div className="flex items-center gap-3 px-4 py-3.5 text-[14px] text-stone-500">
            <MonitorSmartphone className="size-5 text-brand-700" />
            EstateFlow {APP_VERSION}
          </div>
        </Card>
      </Section>

      <Button variant="secondary" block size="lg" icon={LogOut} onClick={() => setSheet('signout')}>
        Sign out
      </Button>

      {sheet === 'edit' && <EditProfileSheet onClose={() => setSheet(null)} />}
      {sheet === 'password' && <PasswordSheet onClose={() => setSheet(null)} />}
      {sheet === 'server' && <ServerSheet onClose={() => setSheet(null)} onSaved={recheckServer} />}
      {sheet === 'signout' && (
        <Sheet open onClose={() => setSheet(null)} title="Sign out">
          {pending.length > 0 && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
              {pending.length} change{pending.length > 1 ? 's have' : ' has'} not synced yet and will be lost if you sign out now.
            </p>
          )}
          <Button block size="lg" onClick={() => void logout(false)}>
            Sign out of this phone
          </Button>
          <Button block variant="danger" onClick={() => void logout(true).then(() => toast.success('Signed out on every device'))}>
            Sign out everywhere
          </Button>
          <p className="text-[13px] text-stone-500">"Everywhere" also signs you out of the dashboard and any other phone.</p>
        </Sheet>
      )}
    </Screen>
  );
}

function EditProfileSheet({ onClose }: { onClose: () => void }) {
  const user = useUser();
  const { setUser } = useSession();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await api.put<{ user: User } | User>('/auth/profile', { name: name.trim(), phone: phone.trim() || null });
      setUser('user' in r ? r.user : r);
      toast.success('Profile updated');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title="Edit profile">
      <Field label="Name">{(id) => <input id={id} className="field" value={name} onChange={(e) => setName(e.target.value)} />}</Field>
      <Field label="Phone">{(id) => <input id={id} type="tel" inputMode="tel" className="field" value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
      <Button block onClick={save} loading={busy}>
        Save
      </Button>
    </Sheet>
  );
}

function PasswordSheet({ onClose }: { onClose: () => void }) {
  const user = useUser();
  const { login } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (next !== confirm) return toast.error('The new passwords do not match');
    setBusy(true);
    try {
      await api.put('/auth/password', { current_password: current, new_password: next });
      // Changing the password signs out every session, this one included; sign straight back in.
      await auth.logout().catch(() => undefined);
      await login(user.email, next, true);
      toast.success('Password changed. Other devices were signed out.');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title="Change password">
      <Field label="Current password">{(id) => <input id={id} type="password" autoComplete="current-password" className="field" value={current} onChange={(e) => setCurrent(e.target.value)} />}</Field>
      <Field label="New password" hint="At least 8 characters with an uppercase letter and a number.">
        {(id) => <input id={id} type="password" autoComplete="new-password" className="field" value={next} onChange={(e) => setNext(e.target.value)} />}
      </Field>
      <Field label="Confirm new password">{(id) => <input id={id} type="password" autoComplete="new-password" className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}</Field>
      <Button block onClick={save} loading={busy}>
        Change password
      </Button>
    </Sheet>
  );
}
