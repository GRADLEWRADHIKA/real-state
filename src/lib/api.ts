import { ApiError, createApiClient, type StoredSession } from '@estateflow/shared';
import { isNative, kv, secure } from './platform';

declare global {
  interface Window {
    ESTATEFLOW_CONFIG?: { apiUrl?: string; websiteUrl?: string };
  }
}

const SESSION_KEY = 'ef_app_session';
const SERVER_KEY = 'ef_server_url';

const clean = (u: string) =>
  u
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/, '');

/** Android emulator alias for the computer's localhost, where `npm run emulator:run` starts the demo API. */
export const EMULATOR_SERVER_URL = 'http://10.0.2.2:7341';
/**
 * Inside the Android app "same origin" is the app itself (https://localhost), which answers every /api call
 * with index.html. So a native build without an address defaults to the emulator; release builds always
 * get VITE_API_URL from `npm run build:release`.
 */
const emulatorDefault = isNative ? EMULATOR_SERVER_URL : '';

/** Build-time / runtime default: /env.js wins over VITE_API_URL; empty means same origin. */
export const defaultServerUrl = clean(window.ESTATEFLOW_CONFIG?.apiUrl || (import.meta.env.VITE_API_URL as string | undefined) || emulatorDefault);

/** Calls /api/health on an address without saving it. */
export async function testServer(url: string): Promise<{ ok: true; ms: number; mode?: string; version?: string } | { ok: false; message: string }> {
  const base = clean(url) || defaultServerUrl;
  const started = Date.now();
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(`${base}/api/health`, { cache: 'no-store', signal: ctl.signal }).finally(() => clearTimeout(timer));
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) return { ok: false, message: `The server answered but is not healthy (HTTP ${res.status}).` };
    const meta = await fetch(`${base}/api/meta`, { cache: 'no-store' })
      .then((r) => r.json())
      .catch(() => ({}));
    return { ok: true, ms: Date.now() - started, mode: meta.mode, version: meta.version };
  } catch (e) {
    const hint = base.startsWith('http://') ? ' Check the server is running and that this is a debug build (release builds only allow https).' : ' Check the address and your internet connection.';
    return { ok: false, message: `${(e as Error).name === 'AbortError' ? 'No answer within 8 seconds.' : 'Could not reach the server.'}${hint}` };
  }
}

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
