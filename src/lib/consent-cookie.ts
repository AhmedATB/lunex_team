import { cookies } from "next/headers";
import { CONSENT_COOKIE, parseConsent, type ConsentChoice } from "@/lib/consent";

/** The visitor's saved cookie choice, read on the server so the banner is present (or absent) in the very first HTML instead of flashing in after hydration. */
export async function getInitialConsent(): Promise<ConsentChoice | null> {
  return parseConsent((await cookies()).get(CONSENT_COOKIE)?.value);
}
