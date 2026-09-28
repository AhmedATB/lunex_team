import "server-only";
import { cookies } from "next/headers";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

/** GET /v1/catalog/admin/dashboard — what the admin overview charts, counted from the database. */
export interface AdminDashboard {
  weeks: { start: string; chapters: number }[];
  teams: { name: string; chapters: number }[];
  recent: { kind: "chapter" | "series" | "member"; text: string; at: string }[];
}

/** For the overview page (a Server Component): null when it cannot be had, and the page shows empty charts rather than failing. */
export async function loadAdminDashboard(): Promise<AdminDashboard | null> {
  const accessToken = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return null;
  const result = await callBackend<AdminDashboard>("/v1/catalog/admin/dashboard", { authToken: accessToken });
  return result.ok ? result.body : null;
}
