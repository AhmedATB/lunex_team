import { cookies } from "next/headers";
import { ADS_CONSENT_COOKIE, CONSENT_COOKIE, parseAdsConsent, parseConsent, type AdsChoice, type ConsentChoice } from "@/lib/consent";

/** The visitor's saved cookie choice, read on the server so the banner is present (or absent) in the very first HTML instead of flashing in after hydration. */
export async function getInitialConsent(): Promise<ConsentChoice | null> {
  return parseConsent((await cookies()).get(CONSENT_COOKIE)?.value);
}

/** The advertising choice, read the same way; missing means the visitor has not been asked yet (an older "accept all" does not cover ads). */
export async function getInitialAdsConsent(): Promise<AdsChoice | null> {
  return parseAdsConsent((await cookies()).get(ADS_CONSENT_COOKIE)?.value);
}
