/**
 * Notifications on the phone or computer (Web Push), from the browser: whether this device can receive them, agreeing to receive
 * them, and stopping. The device's address and keys are kept by the server against the member's account; what is sent is decided
 * there. Everything here is best-effort and never throws — a device that cannot be set up simply stays without notifications.
 */

export type PushSupport = "supported" | "needs-install" | "unsupported";

const WORKER = "/sw.js";

const isIphone = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isInstalledApp = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Whether this browser can receive notifications. An iPhone can only once the site is on its home screen. */
export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window) return "supported";
  return isIphone() && !isInstalledApp() ? "needs-install" : "unsupported";
}

export const pushPermission = (): NotificationPermission => (typeof Notification === "undefined" ? "denied" : Notification.permission);

async function worker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(WORKER);
  return existing ?? navigator.serviceWorker.register(WORKER, { scope: "/" });
}

const toBytes = (key: string) => {
  const base64 = key.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(key.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
};

async function json<T>(res: Response): Promise<T | null> {
  return res.ok ? ((await res.json().catch(() => null)) as T | null) : null;
}

/** This device's subscription in the browser, if it has one. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "supported") return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration(WORKER);
    return (await registration?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

/** Gives the server this device's address and keys (again if it already has them: it moves the device to whoever is signed in). */
async function tell(subscription: PushSubscription): Promise<boolean> {
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  }).catch(() => null);
  return !!res?.ok;
}

export type EnableResult = { ok: true } | { ok: false; reason: "denied" | "unsupported" | "failed" };

/** Asks the browser's permission (it shows its own question) and, if given, starts notifications for the signed-in account on this device. */
export async function enablePush(): Promise<EnableResult> {
  if (pushSupport() !== "supported") return { ok: false, reason: "unsupported" };
  try {
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission !== "granted") return { ok: false, reason: "denied" };
    const registration = await worker();
    await navigator.serviceWorker.ready;
    const key = await fetch("/api/push/public-key", { cache: "no-store" }).then((res) => json<{ publicKey: string }>(res));
    if (!key) return { ok: false, reason: "failed" };
    const options = { userVisibleOnly: true, applicationServerKey: toBytes(key.publicKey) };
    let subscription: PushSubscription;
    try {
      subscription = (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe(options));
    } catch {
      // A subscription made with another key (the site's keys changed) cannot be kept: start again.
      await (await registration.pushManager.getSubscription())?.unsubscribe();
      subscription = await registration.pushManager.subscribe(options);
    }
    return (await tell(subscription)) ? { ok: true } : { ok: false, reason: "failed" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Stops notifications on this device: the server forgets it and the browser drops the subscription. */
export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => null);
  await subscription.unsubscribe().catch(() => false);
}

/** When a member signs out: this device stops receiving that account's notifications (the browser keeps its subscription for the next sign-in). */
export async function detachThisDevice(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => null);
}

/** Someone who already agreed on this device signs in: the device follows the account (a shared phone, a new sign-in), with no question asked. */
export async function reattachThisDevice(): Promise<void> {
  if (pushSupport() !== "supported" || Notification.permission !== "granted") return;
  const subscription = await currentSubscription();
  if (subscription) await tell(subscription);
}

/** Whether the server sends to this device for the signed-in account, and what the account wants. */
export interface PushStatus {
  devices: number;
  thisDevice: boolean;
  preferences: PushPreferences;
}

export type PushCategory = "chapters" | "messages" | "replies" | "news" | "account";
export type PushPreferences = Record<PushCategory, boolean>;

export async function pushStatus(): Promise<PushStatus | null> {
  const subscription = await currentSubscription();
  const query = subscription ? `?endpoint=${encodeURIComponent(subscription.endpoint)}` : "";
  const res = await fetch(`/api/push/status${query}`, { cache: "no-store" }).catch(() => null);
  return res ? json<PushStatus>(res) : null;
}

export async function savePushPreferences(changes: Partial<PushPreferences>): Promise<PushPreferences | null> {
  const res = await fetch("/api/push/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  }).catch(() => null);
  return res ? json<PushPreferences>(res) : null;
}

/** A test notification to the signed-in account's devices. */
export async function sendTestPush(): Promise<{ ok: true; sent: number } | { ok: false }> {
  const res = await fetch("/api/push/test", { method: "POST" }).catch(() => null);
  const body = res ? await json<{ sent: number }>(res) : null;
  return body ? { ok: true, sent: body.sent } : { ok: false };
}
