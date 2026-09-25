/**
 * Who is the visitor? Browsers reach the backend only through this frontend (the BFF), so the backend cannot see them —
 * this file works out their address and the frontend hands it over with a secret only the two services share, so the
 * backend can rate-limit (and log) per visitor instead of treating everyone as one caller (see the backend's
 * RequestContextMiddleware). Written without Node-only imports so the edge middleware can use it too.
 */
type HeaderGetter = (name: string) => string | null | undefined;

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6 = /^[0-9a-f:]+(\.\d{1,3}){0,3}$/i;

function looksLikeIp(value: string): boolean {
  return IPV4.test(value) || (value.includes(":") && value.length <= 45 && IPV6.test(value));
}

/** Constant-time comparison, so a secret cannot be guessed a character at a time from response timing. */
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

/**
 * The visitor's address, or undefined when it cannot be told.
 *
 * Behind Cloudflare the real address is in `CF-Connecting-IP`, but that header is only believable if the request really
 * came through Cloudflare — anyone can send it straight to the Railway address. So it is used only when the request
 * also carries `x-lunex-edge` equal to `CF_EDGE_SECRET`, a header Cloudflare adds with a Transform Rule (docs/cloudflare-protection.md).
 *
 * Otherwise the last entry of `X-Forwarded-For`: the one Railway's edge added for the connection it actually saw. The
 * first entries are whatever the visitor chose to send, so they are never used.
 */
export function resolveClientIp(get: HeaderGetter): string | undefined {
  const edgeSecret = process.env.CF_EDGE_SECRET;
  if (edgeSecret && sameSecret(get("x-lunex-edge") ?? "", edgeSecret)) {
    const viaCloudflare = get("cf-connecting-ip")?.trim();
    if (viaCloudflare && looksLikeIp(viaCloudflare)) return viaCloudflare;
  }
  const last = get("x-forwarded-for")?.split(",").pop()?.trim();
  return last && looksLikeIp(last) ? last : undefined;
}

/** The two headers that identify the visitor to the backend; empty unless `BFF_SHARED_KEY` is set (so deploying this changes nothing by itself). */
export function backendIdentity(get: HeaderGetter): Record<string, string> {
  const key = process.env.BFF_SHARED_KEY;
  if (!key) return {};
  const ip = resolveClientIp(get);
  return ip ? { "x-lunex-bff-key": key, "x-lunex-client-ip": ip } : {};
}
