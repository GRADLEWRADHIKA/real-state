import { useCallback, useSyncExternalStore } from 'react';
import { ApiError, get, type Property } from './api';

/**
 * The visitor's shortlist: property slugs kept only on this device (localStorage). When storage is
 * blocked (private mode, disabled site data) the list lives in memory for the rest of the visit.
 */
const KEY = 'starwiz.shortlist.v1';
const MAX = 50;
export const COMPARE_MIN = 2;
export const COMPARE_MAX = 4;

let memory: string[] | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const clean = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === 'string' && s.length > 0 && s.length <= 120))].slice(0, MAX) : []);

function read(): string[] {
  if (memory) return memory;
  try {
    memory = clean(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
  } catch {
    memory = [];
  }
  return memory;
}

function write(next: string[]) {
  memory = clean(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* storage unavailable: keep the in-memory copy */
  }
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// Keep several open tabs in step.
try {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === null) {
      memory = null;
      emit();
    }
  });
} catch {
  /* no window (not in a browser) */
}

const EMPTY: string[] = [];

export function useShortlist() {
  const slugs = useSyncExternalStore(subscribe, read, () => EMPTY);
  const has = useCallback((slug: string) => slugs.includes(slug), [slugs]);
  const toggle = useCallback((slug: string) => {
    const cur = read();
    write(cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug]);
  }, []);
  const remove = useCallback((...gone: string[]) => write(read().filter((s) => !gone.includes(s))), []);
  return { slugs, has, toggle, remove };
}

/** Loads several properties by slug from the public API; slugs that are no longer listed come back in `missing`. */
export async function getProperties(slugs: string[]): Promise<{ found: Property[]; missing: string[] }> {
  const results = await Promise.allSettled(slugs.map((s) => get<Property>(`/properties/${encodeURIComponent(s)}`)));
  const found: Property[] = [];
  const missing: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') found.push(r.value);
    else if (r.reason instanceof ApiError && r.reason.status === 404) missing.push(slugs[i]);
    else throw r.reason;
  });
  return { found, missing };
}

export const comparePath = (slugs: string[]) => `/homes/compare?slugs=${slugs.map(encodeURIComponent).join(',')}`;

/** Anchor of the site-visit form on a property page. */
export const VISIT_ANCHOR = 'book-visit';
export const visitPath = (slug: string) => `/homes/${encodeURIComponent(slug)}#${VISIT_ANCHOR}`;
