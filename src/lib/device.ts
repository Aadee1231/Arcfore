import * as SecureStore from 'expo-secure-store';
import { newId } from '@/lib/id';

/**
 * Stable per-install device id, stored in the platform keychain so it survives
 * reinstalls where keychain persists. Sent as `x-device-id` so the API can
 * rate-limit per install without requiring an account.
 */

const KEY = 'arcfore.deviceId';
let cached: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  try {
    const existing = await SecureStore.getItemAsync(KEY);
    if (existing) {
      cached = existing;
      return existing;
    }
    const id = newId();
    await SecureStore.setItemAsync(KEY, id);
    cached = id;
    return id;
  } catch {
    // SecureStore unavailable (unlikely on device; possible on web) — fall back
    // to a session-scoped id so requests still work.
    cached ??= `session-${newId()}`;
    return cached;
  }
}
