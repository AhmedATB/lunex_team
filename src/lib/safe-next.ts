/**
 * Where to send a person after they sign in or up: the `next` query parameter, but only a path on this site.
 * Anything else (another host, `//host`, a scheme) is ignored so the sign-in pages cannot be used as an open redirect.
 */
export function nextPathFrom(search: string): string | null {
  const next = new URLSearchParams(search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
