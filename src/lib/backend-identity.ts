import { headers } from "next/headers";
import { backendIdentity } from "@/lib/client-ip";

/**
 * The headers that tell the backend who the visitor is (lib/client-ip.ts), read from the request being served. Outside a
 * request (a build, a background task) there is no visitor, so nothing is added.
 */
export async function identityHeaders(): Promise<Record<string, string>> {
  if (!process.env.BFF_SHARED_KEY) return {};
  try {
    const incoming = await headers();
    return backendIdentity((name) => incoming.get(name));
  } catch {
    return {};
  }
}
