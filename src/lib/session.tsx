import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { APP_VERSION, compareVersions, type ServerMeta, type User } from '@estateflow/shared';
import { api, auth, getServerUrl, isNetworkError, loadServerUrl, onSessionExpired } from './api';
import { isNative, kv } from './platform';
import { biometricEnabled, unlockWithBiometrics } from './biometric';

const USER_KEY = 'ef_app_user';

type Phase = 'booting' | 'signed-out' | 'locked' | 'ready' | 'update-required';

interface SessionCtx {
  phase: Phase;
  user: User | null;
  meta: ServerMeta | null;
  expiredReason: string | null;
  login: (email: string, password: string, remember: boolean) => Promise<User>;
  logout: (everywhere?: boolean) => Promise<void>;
  /** Leaves the lock screen for the password sign-in; work saved offline is kept for the same person. */
  signInWithPassword: () => Promise<void>;
  unlock: () => Promise<boolean>;
  setUser: (u: User) => void;
  /** Re-reads /api/meta; resolves true when this app version is too old for the server. */
  recheckServer: () => Promise<boolean>;
}

const Ctx = createContext<SessionCtx | null>(null);

async function fetchMeta(): Promise<ServerMeta | null> {
  try {
    const res = await fetch(`${getServerUrl()}/api/meta`, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as ServerMeta) : null;
  } catch {
    return null;
  }
}

/**
 * `expired`: the server ended the session. `relogin`: the person left the lock screen to sign in with
 * their password. Both keep work saved offline for the same person; only `logout` discards it.
 */
export type SignOutReason = 'logout' | 'expired' | 'relogin';

export function SessionProvider({ children, onSignedOut }: { children: ReactNode; onSignedOut: (user: User | null, reason: SignOutReason) => Promise<void> | void }) {
  const [phase, setPhase] = useState<Phase>('booting');
  const [user, setUserState] = useState<User | null>(null);
  const [meta, setMeta] = useState<ServerMeta | null>(null);
  const [expiredReason, setExpiredReason] = useState<string | null>(null);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  const setUser = useCallback((u: User) => {
    setUserState(u);
    void kv.set(USER_KEY, JSON.stringify(u));
  }, []);

  const recheckServer = useCallback(async () => {
    const m = await fetchMeta();
    setMeta(m);
    const tooOld = !!m && compareVersions(APP_VERSION, m.minAppVersion) < 0;
    if (tooOld) setPhase('update-required');
    return tooOld;
  }, []);

  useEffect(() => {
    (async () => {
      await loadServerUrl();
      const m = await fetchMeta();
      setMeta(m);
      if (m && compareVersions(APP_VERSION, m.minAppVersion) < 0) return setPhase('update-required');
      if (!(await auth.hasSession())) return setPhase('signed-out');
      let u: User | null = null;
      try {
        u = (await api.get<{ user: User }>('/auth/me')).user;
        await kv.set(USER_KEY, JSON.stringify(u));
      } catch (err) {
        // Offline start: carry on with the profile saved at the last sign-in.
        if (isNetworkError(err)) u = JSON.parse((await kv.get(USER_KEY)) || 'null');
      }
      if (!u || !(await auth.hasSession())) return setPhase('signed-out');
      setUserState(u);
      setPhase(isNative && (await biometricEnabled()) ? 'locked' : 'ready');
    })();
  }, []);

  useEffect(
    () =>
      onSessionExpired((reason) => {
        setExpiredReason(reason);
        void onSignedOut(userRef.current, 'expired');
        setUserState(null);
        setPhase('signed-out');
        void kv.remove(USER_KEY);
      }),
    [onSignedOut],
  );

  const value = useMemo<SessionCtx>(
    () => ({
      phase,
      user,
      meta,
      expiredReason,
      setUser,
      recheckServer,
      async login(email, password, remember) {
        const device = isNative ? 'EstateFlow Android app' : `EstateFlow app (${navigator.userAgent.slice(0, 60)})`;
        const u = await auth.login(email, password, remember, device);
        setExpiredReason(null);
        setUser(u);
        setPhase('ready');
        void recheckServer();
        return u;
      },
      async logout(everywhere = false) {
        if (everywhere) await api.post('/auth/logout-all').catch(() => undefined);
        await auth.logout();
        await kv.remove(USER_KEY);
        await onSignedOut(user, 'logout');
        setUserState(null);
        setPhase('signed-out');
      },
      async signInWithPassword() {
        await auth.logout();
        await kv.remove(USER_KEY);
        await onSignedOut(user, 'relogin');
        setUserState(null);
        setPhase('signed-out');
      },
      async unlock() {
        const ok = await unlockWithBiometrics();
        if (ok) setPhase('ready');
        return ok;
      },
    }),
    [phase, user, meta, expiredReason, setUser, recheckServer, onSignedOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}

/** Signed-in user (only use inside the signed-in shells). */
export function useUser(): User {
  const u = useSession().user;
  if (!u) throw new Error('No user');
  return u;
}

/** Staff roles (administrators included) can make changes from the app; the server enforces each action. */
export const canWrite = (u: User) => u.role !== 'customer';
