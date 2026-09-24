import { NextResponse, type NextRequest } from "next/server";
import { SITE_URL } from "@/lib/site";

/** A bare hostname with an optional port — anything else in a forwarded header is ignored rather than trusted. */
const HOST_PATTERN = /^[a-z0-9.-]+(:\d{1,5})?$/i;

const firstValue = (header: string | null) => header?.split(",")[0]?.trim() ?? "";

/**
 * The origin the visitor's browser actually used.
 *
 * Behind a reverse proxy (Railway), Next.js builds `req.url` from the
 * container's own address, so a redirect made with `new URL(path, req.url)`
 * sent a signed-in visitor to https://localhost:8080. The proxy's forwarded
 * headers carry the real public host; if they are missing or malformed we
 * fall back to the canonical site URL rather than a guessed address.
 */
export function publicOrigin(req: NextRequest): string {
  const host = firstValue(req.headers.get("x-forwarded-host")) || firstValue(req.headers.get("host"));
  if (!HOST_PATTERN.test(host)) return SITE_URL;

  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const forwardedProto = firstValue(req.headers.get("x-forwarded-proto"));
  const protocol = forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : isLocal ? "http" : "https";
  return `${protocol}://${host}`;
}

/** Redirect to a path on this site, on the host the visitor is actually browsing. */
export function redirectTo(req: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, publicOrigin(req)));
}
