import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { callBackend } from "@/lib/backend-client";
import { resolveClientIp } from "@/lib/client-ip";

export const dynamic = "force-dynamic";

/**
 * "Who does the site think I am?" — the address the frontend worked out for the caller, the chain of forwarding headers it
 * worked it out from, and the address the backend ended up with. They should match the caller's own, and `verified` should
 * be true; that is how a deployment of the per-visitor rate limiting is checked (security architecture §14). It only ever
 * describes the caller itself (and the proxy hops in front of it).
 */
export async function GET() {
  const incoming = await headers();
  const forwarded = (incoming.get("x-forwarded-for") ?? "").split(",").map((part) => part.trim()).filter(Boolean);

  const result = await callBackend<{ ip: string; verified: boolean }>("/v1/security/client");
  return NextResponse.json(
    {
      frontend: {
        ip: resolveClientIp((name) => incoming.get(name)) ?? null,
        forwarded,
        realIp: incoming.get("x-real-ip"),
        viaCloudflare: Boolean(incoming.get("cf-connecting-ip")),
      },
      backend: result.ok ? result.body : null,
    },
    { status: result.ok ? 200 : result.status, headers: { "Cache-Control": "no-store" } }
  );
}
