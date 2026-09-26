/**
 * Who may open what without an account.
 *
 * A visitor with no account is a follower: they can browse the catalogue — the home page, the series pages, the search,
 * the teams and the news — read the site's rules, and read the chapters that are open (not locked). Everything that needs
 * an account stays behind the sign-in page: locked chapters (the server refuses their pages), comments, ratings, the
 * library, messages, the store, profiles, notifications, team dashboards and the admin area. (Signing in from a locked
 * page brings the visitor back to it.)
 */

/** Reachable without an account: signing in/up, password reset, and the terms and privacy policy (linked from the sign-up form). */
export const PUBLIC_PAGES = ["/login", "/register", "/forgot-password", "/terms", "/privacy"] as const;

/**
 * The pages a follower may open. A series' own page is one segment (`/series/<slug>`); the reader is one deeper
 * (`/series/<slug>/<chapter>`) and is open too — what stays closed to a visitor is a *locked* chapter's pages, which the
 * server refuses. `/teams/create` and a team's `/dashboard` are not listed.
 */
const BROWSE_PAGES: readonly RegExp[] = [
  /^\/$/,
  /^\/series$/,
  /^\/series\/[^/]+$/,
  /^\/series\/[^/]+\/[^/]+$/,
  /^\/search$/,
  /^\/news$/,
  /^\/teams$/,
  /^\/teams\/(?!create$)[^/]+$/,
];

/**
 * Data the browsing pages ask for after they load, readable without an account (GET only): the catalogue (series detail,
 * pictures, ratings' totals, news) and the comment threads. The owner's import tools and the editors' own lists sit under the same
 * prefix and stay locked, as does the moderators' comment list. Anything that writes, and everything personal (`/api/me`, notifications, the wallet, chapter pages), needs a session.
 */
const PUBLIC_READS: readonly RegExp[] = [
  // the chapter lists and page details the reader needs (page bytes only ever come with a signed token)
  /^\/api\/chapters$/,
  /^\/api\/chapters\/(?!admin\/)[^/]+$/,
  /^\/api\/images\/[^/]+\/stream$/,/^\/api\/catalog\/(?!(?:import|admin)(?:\/|$))/, /^\/api\/comments(?!\/admin(?:\/|$))(?:\/|$)/];

/** The one write a visitor may make: asking for a page of a chapter to read (the server checks the chapter is not locked). */
const PUBLIC_WRITES: readonly RegExp[] = [/^\/api\/chapters\/[^/]+\/pages\/\d+\/token$/];

/** Files served as-is (logo, fonts, robots.txt, sitemap.xml ...). They carry no catalogue data. */
const STATIC_FILE = /\.(?:png|jpe?g|webp|avif|gif|svg|ico|css|js|map|woff2?|ttf|txt|xml|webmanifest)$/i;

/**
 * A member's profile picture. Pages show it through next/image, whose optimizer fetches the picture itself, on the
 * server and without the visitor's cookies, so it must be reachable without a session. It is public on the backend too
 * (`GET /v1/users/:id/avatar`), keyed by an unguessable id.
 */
const AVATAR_IMAGE = /^\/api\/users\/[^/]+\/avatar$/;

export function isPublicRequest(pathname: string, method = "GET"): boolean {
  if (STATIC_FILE.test(pathname) || AVATAR_IMAGE.test(pathname)) return true;
  if (PUBLIC_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`))) return true;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (method === "GET" || method === "HEAD") {
    if (BROWSE_PAGES.some((pattern) => pattern.test(path))) return true;
    if (PUBLIC_READS.some((pattern) => pattern.test(path))) return true;
  }
  if (method === "POST" && PUBLIC_WRITES.some((pattern) => pattern.test(path))) return true;
  return false;
}
