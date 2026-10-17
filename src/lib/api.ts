import { ApiError, createApiClient, type StoredSession } from '@estateflow/shared';
import { kv, secure } from './platform';

declare global {
  interface Window {
    ESTATEFLOW_CONFIG?: { apiUrl?: string };
  }
}

const SESSION_KEY = 'ef_app_session';
const SERVER_KEY = 'ef_server_url';

const clean = (u: string) => u.trim().replace(/\/+$/, '').replace(/\/api$/, '');

/** Build-time / runtime default: /env.js wins over VITE_API_URL; empty means same origin. */
export const defaultServerUrl = clean(window.ESTATEFLOW_CONFIG?.apiUrl || (import.meta.env.VITE_API_URL as string | undefined) || '');

let serverUrl = defaultServerUrl;

export async function loadServerUrl() {
  serverUrl = clean((await kv.get(SERVER_KEY)) || defaultServerUrl);
  return serverUrl;
}
export const getServerUrl = () => serverUrl;
export async function setServerUrl(url: string) {
  serverUrl = clean(url) || defaultServerUrl;
  if (clean(url) && clean(url) !== defaultServerUrl) await kv.set(SERVER_KEY, clean(url));
  else await kv.remove(SERVER_KEY);
}

type ExpiredListener = (reason: string) => void;
const expiredListeners = new Set<ExpiredListener>();
export const onSessionExpired = (fn: ExpiredListener) => {
  expiredListeners.add(fn);
  return () => void expiredListeners.delete(fn);
};

export const client = createApiClient({
  client: 'app',
  baseUrl: getServerUrl,
  storage: {
    async load() {
      const raw = await secure.get(SESSION_KEY);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as StoredSession;
      } catch {
        return null;
      }
    },
    save: (s) => secure.set(SESSION_KEY, JSON.stringify(s)),
    clear: () => secure.remove(SESSION_KEY),
  },
  onSessionExpired: (reason) => expiredListeners.forEach((fn) => fn(reason)),
});

export const api = client.api;
export const auth = client.auth;
export { ApiError };

/** User-facing message for any thrown value. */
export function errorMessage(err: unknown) {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}

export const isNetworkError = (err: unknown) => err instanceof ApiError && err.status === 0;
