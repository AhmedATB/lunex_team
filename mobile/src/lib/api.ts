import { SITE_URL, USER_AGENT } from "./config";
import { getDeviceId } from "./device";

/** A refused or failed request. `code` is the backend's machine-readable reason when it gave one. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

/** A response that says "try again later" rather than "no". */
export const retryableStatus = (status: number) => status === 0 || status === 408 || status === 425 || status === 429 || status >= 500;

/**
 * One request to the site's `/api`. The session lives in the site's httpOnly cookies, which the native networking layer keeps
 * and sends back on its own — exactly as a browser would — so nothing here ever touches a token.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("User-Agent", USER_AGENT);
  headers.set("x-device-fingerprint", await getDeviceId());
  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  try {
    return await fetch(`${SITE_URL}${path}`, { ...init, headers, credentials: "include" });
  } catch {
    throw new ApiError(0, "network", "تعذر الاتصال. تأكد من الإنترنت وحاول مرة أخرى.");
  }
}

/** A JSON request; throws ApiError for anything but a 2xx. */
export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body?.code, typeof body?.message === "string" ? body.message : "حدث خطأ غير متوقع.");
  }
  return body as T;
}
