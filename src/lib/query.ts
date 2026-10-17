import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { APP_VERSION } from '@estateflow/shared';
import { ApiError } from './api';
import { kv } from './platform';

const CACHE_KEY = 'ef_query_cache';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Kept for a day so the last-seen lists open instantly (and offline) on the next launch.
      gcTime: 24 * 60 * 60_000,
      networkMode: 'offlineFirst',
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
      refetchOnWindowFocus: true,
    },
    mutations: { networkMode: 'always' },
  },
});

export const persister = createAsyncStoragePersister({
  storage: { getItem: kv.get, setItem: kv.set, removeItem: kv.remove },
  key: CACHE_KEY,
  throttleTime: 2000,
});

export const persistOptions = {
  persister,
  maxAge: 24 * 60 * 60_000,
  buster: APP_VERSION,
  dehydrateOptions: {
    // Never write file downloads or failed queries to disk.
    shouldDehydrateQuery: (q: { state: { status: string }; queryKey: readonly unknown[] }) => q.state.status === 'success' && q.queryKey[0] !== 'blob',
  },
};

/** Sign-out: nothing from the previous person stays on the phone. */
export async function clearCachedData() {
  queryClient.clear();
  await kv.remove(CACHE_KEY);
}
