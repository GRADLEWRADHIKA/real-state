import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();

/**
 * Small key-value store for app state (server address, preferences, offline queue, query cache).
 * Capacitor Preferences on the phone, localStorage in the browser.
 */
export const kv = {
  async get(key: string): Promise<string | null> {
    if (isNative) {
      const { Preferences } = await import('@capacitor/preferences');
      return (await Preferences.get({ key })).value;
    }
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string) {
    if (isNative) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key, value });
      return;
    }
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage full or unavailable: the value only lives for this session */
    }
  },
  async remove(key: string) {
    if (isNative) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key });
      return;
    }
    try {
      localStorage.removeItem(key);
    } catch {
      /* unavailable */
    }
  },
};

/** Secrets (refresh tokens): Android Keystore-backed secure storage on the phone, localStorage in the browser. */
export const secure = {
  async get(key: string): Promise<string | null> {
    if (isNative) {
      const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
      try {
        return await SecureStorage.getItem(key);
      } catch {
        return null;
      }
    }
    return kv.get(key);
  },
  async set(key: string, value: string) {
    if (isNative) {
      const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
      await SecureStorage.setItem(key, value);
      return;
    }
    await kv.set(key, value);
  },
  async remove(key: string) {
    if (isNative) {
      const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
      await SecureStorage.removeItem(key).catch(() => undefined);
      return;
    }
    await kv.remove(key);
  },
};

/** Native shell setup: status bar colour, splash hand-off and the hardware back button. */
export async function initNative() {
  if (!isNative) return;
  document.documentElement.classList.add('native');
  try {
    const [{ StatusBar, Style }, { SplashScreen }, { App }] = await Promise.all([
      import('@capacitor/status-bar'),
      import('@capacitor/splash-screen'),
      import('@capacitor/app'),
    ]);
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#062419' });
    setTimeout(() => SplashScreen.hide({ fadeOutDuration: 250 }), 300);
    App.addListener('backButton', ({ canGoBack }) => {
      if (document.querySelector('[data-sheet-open]')) {
        window.dispatchEvent(new CustomEvent('ef:close-sheet'));
        return;
      }
      if (canGoBack) window.history.back();
      else App.exitApp();
    });
  } catch (e) {
    console.warn('Native init failed', e);
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * Saves a downloaded file. On the phone it is written to the app cache and handed to the share
 * sheet (save to Files, WhatsApp, email...). In the browser it downloads normally.
 */
export async function saveFile(blob: Blob, fileName: string, title = fileName) {
  if (isNative) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const safe = fileName.replace(/[^\w.\- ]+/g, '_');
    const written = await Filesystem.writeFile({ path: safe, data: await blobToBase64(blob), directory: Directory.Cache });
    await Share.share({ title, files: [written.uri], dialogTitle: title });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
