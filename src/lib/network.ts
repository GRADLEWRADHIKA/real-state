import { useSyncExternalStore } from 'react';
import { isNative } from './platform';

/** Connectivity: @capacitor/network on the phone, navigator.onLine in the browser. */
let online = typeof navigator === 'undefined' ? true : navigator.onLine;
const listeners = new Set<() => void>();
const emit = (v: boolean) => {
  if (v === online) return;
  online = v;
  listeners.forEach((l) => l());
};

let started = false;
export function startNetworkWatch() {
  if (started) return;
  started = true;
  window.addEventListener('online', () => emit(true));
  window.addEventListener('offline', () => emit(false));
  if (isNative) {
    void import('@capacitor/network').then(async ({ Network }) => {
      emit((await Network.getStatus()).connected);
      await Network.addListener('networkStatusChange', (s) => emit(s.connected));
    });
  }
}

export const isOnline = () => online;
export function subscribeOnline(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
export const useOnline = () => useSyncExternalStore(subscribeOnline, isOnline, () => true);
