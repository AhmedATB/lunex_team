import { randomUUID } from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const KEY = "lunex-device-id";
let cached: Promise<string> | null = null;

/**
 * A random id kept for the life of the install, sent as `x-device-fingerprint` — the same contract as the site's per-browser
 * id: it ties a session to the device that created it.
 */
export function getDeviceId(): Promise<string> {
  cached ??= (async () => {
    const existing = await SecureStore.getItemAsync(KEY).catch(() => null);
    if (existing) return existing;
    const id = randomUUID();
    await SecureStore.setItemAsync(KEY, id).catch(() => {});
    return id;
  })();
  return cached;
}
