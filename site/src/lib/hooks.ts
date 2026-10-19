import { useEffect, useState } from 'react';
import { get, type Company } from './api';

const FALLBACK: Company = { name: 'Starwiz Realty', tagline: 'Your Trust. Our Vision.', testimonials: [] };
let companyCache: Promise<Company> | null = null;

/** Company details from EstateFlow settings, fetched once per visit. */
export function useCompany() {
  const [c, setC] = useState<Company>(FALLBACK);
  useEffect(() => {
    companyCache ??= get<Company>('/company').catch(() => {
      companyCache = null;
      return FALLBACK;
    });
    let live = true;
    companyCache.then((v) => live && setC(v));
    return () => {
      live = false;
    };
  }, []);
  return c;
}

/** Small fetch hook: data, error and loading for one request key. */
export function useApi<T>(fn: () => Promise<T>, key: string) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  useEffect(() => {
    let live = true;
    setState((s) => ({ data: s.data, loading: true }));
    fn().then(
      (data) => live && setState({ data, loading: false }),
      (e: Error & { status?: number }) => live && setState({ error: e.message, loading: false, ...(e.status === 404 ? { data: undefined } : {}) }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}
