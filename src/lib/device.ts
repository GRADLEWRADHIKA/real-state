import { isNative } from './platform';

/** Current position for visit check-in/out; null when the person declines or there is no fix in time. */
export async function currentPosition(timeout = 10_000): Promise<{ lat: number; lng: number } | null> {
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    if (isNative) {
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted' && (await Geolocation.requestPermissions({ permissions: ['location'] })).location !== 'granted') return null;
    }
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout, maximumAge: 60_000 });
    return { lat: Number(p.coords.latitude.toFixed(6)), lng: Number(p.coords.longitude.toFixed(6)) };
  } catch {
    return null;
  }
}

/** Takes a photo with the phone camera (native only). Returns null if cancelled. */
export async function takePhoto(): Promise<File | null> {
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  try {
    const photo = await Camera.getPhoto({ quality: 70, width: 1600, resultType: CameraResultType.Uri, source: CameraSource.Prompt, saveToGallery: false, correctOrientation: true });
    if (!photo.webPath) return null;
    const blob = await (await fetch(photo.webPath)).blob();
    const ext = photo.format === 'png' ? 'png' : 'jpg';
    return new File([blob], `site-visit-${Date.now()}.${ext}`, { type: blob.type || `image/${ext === 'jpg' ? 'jpeg' : ext}` });
  } catch (e) {
    if (/cancel/i.test(String((e as Error)?.message))) return null;
    throw e;
  }
}
