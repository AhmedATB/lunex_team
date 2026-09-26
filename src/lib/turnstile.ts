/**
 * Cloudflare Turnstile — the "I am not a robot" box on the sign-up, sign-in and forgot-password forms. The public site key is
 * baked in at build time (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`); the matching secret lives only on the backend
 * (`TURNSTILE_SECRET_KEY`). Set both, or neither: with no site key the forms show no box, and with no secret the backend asks for
 * no token.
 */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
export const TURNSTILE_ENABLED = TURNSTILE_SITE_KEY.length > 0;

/** The header the browser sends the widget's token in; the BFF routes forward it to the backend untouched. */
export const TURNSTILE_HEADER = "x-turnstile-token";

interface TurnstileApi {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<TurnstileApi> | null = null;

/** Loads Cloudflare's script once. A failure (blocked by an extension, no network) is not cached, so the person can try again. */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")));
    script.onerror = () => reject(new Error("turnstile blocked"));
    document.head.appendChild(script);
  }).catch((error) => {
    loading = null;
    document.querySelector(`script[src="${SCRIPT_SRC}"]`)?.remove();
    throw error;
  });
  return loading;
}

/** What the backend said, in Arabic, when it refused for the box; null for any other answer. */
export function turnstileErrorMessage(code: string | undefined): string | null {
  if (code === "turnstile_required") return "أكّد أنك لست روبوتًا بالضغط على المربع أعلاه.";
  if (code === "turnstile_failed") return "لم ينجح التحقق. حاول مرة أخرى.";
  return null;
}
