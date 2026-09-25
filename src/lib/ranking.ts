import type { Series } from "@/lib/types";

/**
 * How the site orders works in its sections. Three ideas, so a list says what it is ordered by:
 *  - "this week": how many readers opened its chapters in the last 7 days (viewsWeek), ties broken by rating;
 *  - "popular": all-time views, weighted by rating, so a much-read work that readers rate badly slips;
 *  - "top rated": the rating, but pulled toward the middle when few people have rated (a single 5-star vote
 *    must not beat a work with hundreds of 4.6s).
 * Every function is pure and works on the fields the catalogue already carries.
 */

/** What a work with no ratings is assumed to be worth, and how many "virtual votes" that assumption counts for. */
const PRIOR_MEAN = 3.5;
const PRIOR_VOTES = 5;

/** 0–5. The average pulled toward PRIOR_MEAN in proportion to how few ratings it rests on. */
export function ratingScore(series: Pick<Series, "rating" | "ratingCount">): number {
  const votes = Math.max(0, series.ratingCount);
  return (votes * series.rating + PRIOR_VOTES * PRIOR_MEAN) / (votes + PRIOR_VOTES);
}

/** Views, weighted 60–100% by how well readers rate it. */
export function popularityScore(series: Pick<Series, "views" | "rating" | "ratingCount">): number {
  return series.views * (0.6 + (0.4 * ratingScore(series)) / 5);
}

const newest = (a: Pick<Series, "updatedAt">, b: Pick<Series, "updatedAt">) => +new Date(b.updatedAt) - +new Date(a.updatedAt);

export function byThisWeek(a: Series, b: Series): number {
  return (b.viewsWeek ?? 0) - (a.viewsWeek ?? 0) || ratingScore(b) - ratingScore(a) || b.views - a.views || newest(a, b);
}

export function byPopularity(a: Series, b: Series): number {
  return popularityScore(b) - popularityScore(a) || b.bookmarks - a.bookmarks || newest(a, b);
}

export function byTopRated(a: Series, b: Series): number {
  return ratingScore(b) - ratingScore(a) || b.ratingCount - a.ratingCount || b.views - a.views || newest(a, b);
}

export function byViews(a: Series, b: Series): number {
  return b.views - a.views || newest(a, b);
}

export function byFollowers(a: Series, b: Series): number {
  return b.bookmarks - a.bookmarks || byPopularity(a, b);
}
