import { useCallback, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Toaster } from 'sonner';
import { CalendarCheck2, FileText, Home, Inbox, LayoutGrid, MapPinned, Menu, Receipt, Sun, UserRound, Users } from 'lucide-react';
import type { User } from '@estateflow/shared';
import { siteRoutes } from '@estateflow/site';
import { clearCachedData, persistOptions, queryClient } from '@/lib/query';
import { kv } from '@/lib/platform';
import { SessionProvider, useSession, type SignOutReason } from '@/lib/session';
import { useRealtime } from '@/lib/realtime';
import { listenForReminderTaps, syncReminders } from '@/lib/reminders';
import { OfflineProvider, queueKey } from '@/offline/OfflineProvider';
import { TabShell, useNotifications, type Tab } from '@/components/shell';
import { Booting, Locked, Login, UpdateRequired } from '@/pages/auth';
import { More, Notifications, Profile } from '@/pages/common';
import { appLink } from '@/lib/links';
import { CustomerDocuments, CustomerHome, CustomerPayments, CustomerRequests } from '@/pages/customer';
import Today, { useToday } from '@/pages/staff/Today';
import Leads from '@/pages/staff/Leads';
import LeadDetail from '@/pages/staff/LeadDetail';
import Visits from '@/pages/staff/Visits';
import VisitDetail from '@/pages/staff/VisitDetail';
import Followups from '@/pages/staff/Followups';
import Tasks from '@/pages/staff/Tasks';
import Customers, { CustomerDetail } from '@/pages/staff/Customers';
import StaffRequests from '@/pages/staff/Requests';
import { Properties, PropertyDetail } from '@/pages/staff/Properties';

/** Signed-in people can still open the website's property pages (shared links); this leads back. */
const BACK_TO_APP = { to: '/', label: 'Back to the app' };

/** Realtime updates and taps on on-device reminders, for whoever is signed in. */
function useLiveApp(user: User) {
  const navigate = useNavigate();
  useRealtime(true, (link) => appLink(link, user.role));
  useEffect(() => {
    let off: (() => void) | undefined;
    void listenForReminderTaps((link) => navigate(appLink(link, user.role))).then((fn) => (off = fn));
    return () => off?.();
  }, [navigate, user.role]);
}

function StaffApp({ user }: { user: User }) {
  useLiveApp(user);
  const today = useToday();
  const unread = useNotifications().data?.meta.unread;
  const fieldStaff = user.role !== 'accounts';

  // Keep this phone's reminders in step with the latest "my day".
  useEffect(() => {
    if (today.data && fieldStaff) void syncReminders({ followups: [...today.data.followups.overdue, ...today.data.followups.today], visits: today.data.visits });
  }, [today.data, fieldStaff]);

  const overdue = today.data?.followups.overdue.length;
  const tabs: Tab[] = fieldStaff
    ? [
        { to: '/today', label: 'My day', icon: Sun },
        { to: '/leads', label: 'Leads', icon: Users },
        { to: '/site-visits', label: 'Visits', icon: MapPinned },
        { to: '/followups', label: 'Follow-ups', icon: CalendarCheck2, badge: overdue },
        { to: '/more', label: 'More', icon: Menu, badge: unread },
      ]
    : [
        { to: '/today', label: 'Today', icon: Sun },
        { to: '/customers', label: 'Customers', icon: Users },
        { to: '/requests', label: 'Requests', icon: Inbox },
        { to: '/more', label: 'More', icon: LayoutGrid, badge: unread },
      ];

  return (
    <Routes>
      {siteRoutes({ withHome: false, account: BACK_TO_APP })}
      <Route element={<TabShell tabs={tabs} />}>
        <Route path="/today" element={<Today />} />
        {fieldStaff && (
          <>
            <Route path="/leads" element={<Leads />} />
            <Route path="/leads/:id" element={<LeadDetail />} />
            <Route path="/site-visits" element={<Visits />} />
            <Route path="/site-visits/:id" element={<VisitDetail />} />
            <Route path="/followups" element={<Followups />} />
          </>
        )}
        <Route path="/properties" element={<Properties />} />
        <Route path="/properties/:id" element={<PropertyDetail />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/requests" element={<StaffRequests />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/more" element={<More />} />
      </Route>
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  );
}

function CustomerApp({ user }: { user: User }) {
  useLiveApp(user);
  const unread = useNotifications().data?.meta.unread;
  const tabs: Tab[] = [
    { to: '/home', label: 'Home', icon: Home },
    { to: '/payments', label: 'Payments', icon: Receipt },
    { to: '/documents', label: 'Documents', icon: FileText },
    { to: '/requests', label: 'Requests', icon: Inbox },
    { to: '/profile', label: 'Profile', icon: UserRound, badge: unread },
  ];
  return (
    <Routes>
      {siteRoutes({ withHome: false, account: BACK_TO_APP })}
      <Route element={<TabShell tabs={tabs} />}>
        <Route path="/home" element={<CustomerHome />} />
        <Route path="/payments" element={<CustomerPayments />} />
        <Route path="/documents" element={<CustomerDocuments />} />
        <Route path="/requests" element={<CustomerRequests />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="/property" element={<Navigate to="/home" replace />} />
      <Route path="/receipts/:id" element={<ReceiptRedirect />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}

function ReceiptRedirect() {
  const { id } = useParams();
  return <Navigate to={`/payments?receipt=${id}`} replace />;
}

function Gate() {
  const { phase, user } = useSession();
  if (phase === 'booting') return <Booting />;
  if (phase === 'update-required') return <UpdateRequired />;
  if (phase === 'locked') return <Locked />;
  // Signed out: the sign-in screen opens first; the website's property pages stay open from its "Browse our homes" link.
  if (phase === 'signed-out' || !user)
    return (
      <Routes>
        {siteRoutes({ withHome: false, account: { to: '/login', label: 'Sign in' } })}
        <Route path="*" element={<Login />} />
      </Routes>
    );
  return (
    <OfflineProvider key={user.id} userId={user.id}>
      {user.role === 'customer' ? <CustomerApp user={user} /> : <StaffApp user={user} />}
    </OfflineProvider>
  );
}

export default function App() {
  const onSignedOut = useCallback(async (user: User | null, reason: SignOutReason) => {
    await clearCachedData();
    // Signing out on purpose discards unsynced work; an expired session keeps it for the same person.
    if (user && reason === 'logout') await kv.remove(queueKey(user.id));
  }, []);
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <BrowserRouter>
        <SessionProvider onSignedOut={onSignedOut}>
          <Gate />
        </SessionProvider>
      </BrowserRouter>
      <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: 'var(--font-sans)' } }} offset={{ top: 'calc(env(safe-area-inset-top) + 12px)' }} />
    </PersistQueryClientProvider>
  );
}
