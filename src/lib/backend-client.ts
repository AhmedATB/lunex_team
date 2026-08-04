const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";
const BFF_USER_AGENT = "LunexTeamBFF/1.0 (+server-to-server)";

export interface BackendResult<T> {
  status: number;
  ok: boolean;
  body: T;
}

/**
 * The ONLY place in this app that talks to the real backend — the browser
 * never calls it directly (BFF pattern). That keeps the backend reachable
 * only from trusted server code in production (it can sit off the public
 * internet entirely) and keeps auth tokens out of client JS altogether:
 * Route Handlers set them as httpOnly cookies and never echo them back.
 *
 * `forwardedHeaders` carries whatever the REAL browser computed and sent to
 * US (device fingerprint, proof-of-work solution) through unmodified — those
 * are what make the backend's anti-bot checks mean anything, so this proxy
 * must never regenerate or strip them. The User-Agent, by contrast, is ours
 * to set: this server-to-server call needs its own honest identity, not a
 * spoofed browser UA (Node's default fetch UA would otherwise get blocked
 * by BotUserAgentGuard, since it isn't a browser and isn't empty either).
 */
export async function callBackend<T>(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    forwardedHeaders?: Record<string, string | undefined>;
    authToken?: string;
  } = {}
): Promise<BackendResult<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": BFF_USER_AGENT,
  };
  for (const [key, value] of Object.entries(init.forwardedHeaders ?? {})) {
    if (value) headers[key] = value;
  }
  if (init.authToken) headers.Authorization = `Bearer ${init.authToken}`;

  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  const body = (await res.json().catch(() => null)) as T;
  return { status: res.status, ok: res.ok, body };
}
