import { isNative, kv } from './platform';

const KEY = 'ef_biometric_lock';

/** Optional fingerprint / face unlock when the app opens with a saved session (phone only). */
export async function biometricAvailable() {
  if (!isNative) return false;
  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
    return (await NativeBiometric.isAvailable()).isAvailable;
  } catch {
    return false;
  }
}

export async function biometricEnabled() {
  return (await kv.get(KEY)) === '1';
}

export async function setBiometricEnabled(on: boolean) {
  if (on) {
    // Confirm the person can actually unlock before turning the lock on.
    if (!(await unlockWithBiometrics('Turn on fingerprint unlock'))) return false;
    await kv.set(KEY, '1');
    return true;
  }
  await kv.remove(KEY);
  return true;
}

export async function unlockWithBiometrics(reason = 'Unlock EstateFlow') {
  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
    await NativeBiometric.verifyIdentity({ reason, title: 'EstateFlow', subtitle: reason, negativeButtonText: 'Cancel', useFallback: true });
    return true;
  } catch {
    return false;
  }
}
