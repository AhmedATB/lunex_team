import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { callBackend } from "@/lib/backend-client";
import { resolveClientIp } from "@/lib/client-ip";

export const dynamic = "force-dynamic";

/**
 * "Who does the site think I am?" — the address the frontend worked out for the caller and the one the backend ended up
 * with. They should match, and `verified` should be true; that is how a deployment of the per-visitor rate limiting is
 * checked (security architecture §14). It only ever describes the caller itself.
 */
export async function GET() {
  const incoming = await headers();
  const seenHere = resolveClientIp((name) => incoming.get(name));
  const forwardedEntries = (incoming.get("x-forwarded-for") ?? "").split(",").filter((part) => part.trim()).length;

  const result = await callBackend<{ ip: string; verified: boolean }>("/v1/security/client");
  return NextResponse.json(
    { frontend: { ip: seenHere ?? null, forwardedEntries }, backend: result.ok ? result.body : null },
    { status: result.ok ? 200 : result.status, headers: { "Cache-Control": "no-store" } }
  );
}
