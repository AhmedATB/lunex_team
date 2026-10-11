import "server-only";
import { headers } from "next/headers";

/**
 * The phone app shows some of the site's pages (settings, messages, news, team dashboards…) inside its own screens, in a web view
 * that adds this word to its User-Agent. Those pages then drop the site's own frame — header, news strip, footer, bottom bar — and
 * its ads and cookie banner: the app draws its own frame, and an app on Google Play may not show web ads or pop-ups.
 */
export const APP_USER_AGENT_MARK = "LunexApp";

export async function isInApp(): Promise<boolean> {
  try {
    return ((await headers()).get("user-agent") ?? "").includes(APP_USER_AGENT_MARK);
  } catch {
    return false;
  }
}
