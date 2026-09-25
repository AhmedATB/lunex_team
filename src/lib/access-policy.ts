/**
 * Who may see the site without an account.
 *
 * By default nobody: every page (and every data route) sends a visitor to the sign-in page, except the
 * few pages a person needs in order to sign in or to read the rules they are agreeing to. Set
 * SITE_REQUIRES_LOGIN=false in the environment to open the site to everyone again — nothing else changes.
 */
export const SITE_REQUIRES_LOGIN = process.env.SITE_REQUIRES_LOGIN !== "false";

/** Reachable without an account: signing in/up, password reset, and the terms and privacy policy (linked from the sign-up form). */
export const PUBLIC_PAGES = ["/login", "/register", "/forgot-password", "/terms", "/privacy"] as const;

/** Files served as-is (logo, fonts, robots.txt, sitemap.xml ...). They carry no catalogue data. */
const STATIC_FILE = /\.(?:png|jpe?g|webp|avif|gif|svg|ico|css|js|map|woff2?|ttf|txt|xml|webmanifest)$/i;

export function isPublicPath(pathname: string): boolean {
  if (STATIC_FILE.test(pathname)) return true;
  return PUBLIC_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));
}
