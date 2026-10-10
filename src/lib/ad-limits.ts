/**
 * A lighter ad load on phones. A narrow screen has little room, and the social bar covers the top of it, so ads that are fine on a
 * laptop or a tablet feel like spam there. Laptops and tablets are not limited here.
 *
 * The counts live in the tab's session storage — gone when the visit ends, never sent anywhere — so a visitor who comes back
 * later starts a fresh, small budget again rather than being followed by a counter.
 */
const PHONE_QUERY = "(max-width: 767px)";

/** On a phone the social bar waits until the visitor has opened this many browsing pages in the visit, then loads once. */
export const PHONE_SOCIAL_BAR_AFTER_PAGES = 3;
/** On a phone, the placed banners shown in one visit, in all. */
export const PHONE_MAX_BANNERS_PER_VISIT = 2;

const KEY = "lunex-ads-visit";

interface Visit {
  pages: number;
  banners: number;
}

function read(): Visit {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Partial<Visit> | null;
    return { pages: Number(parsed?.pages) || 0, banners: Number(parsed?.banners) || 0 };
  } catch {
    return { pages: 0, banners: 0 };
  }
}

function write(visit: Visit) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(visit));
  } catch {
    /* private mode or storage off: the limits then simply do not persist, they never block the page */
  }
}

export function isPhone(): boolean {
  return typeof window !== "undefined" && window.matchMedia(PHONE_QUERY).matches;
}

/** Counts one more browsing page opened in this visit (once per page view). */
export function countPage(): void {
  const visit = read();
  write({ ...visit, pages: visit.pages + 1 });
}

/** May the social bar load now? Always on bigger screens; on a phone only once the visitor has opened a few pages. */
export function socialBarAllowed(): boolean {
  return !isPhone() || read().pages >= PHONE_SOCIAL_BAR_AFTER_PAGES;
}

/** Takes one banner from the visit's budget. Always true on bigger screens; on a phone false once the budget is spent. */
export function takeBanner(): boolean {
  if (!isPhone()) return true;
  const visit = read();
  if (visit.banners >= PHONE_MAX_BANNERS_PER_VISIT) return false;
  write({ ...visit, banners: visit.banners + 1 });
  return true;
}
