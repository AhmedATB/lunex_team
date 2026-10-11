import { useQuery } from "@tanstack/react-query";
import { isLockedByRule } from "@/lib/chapter-lock";
import { apiJson } from "./api";
import { useSession } from "./session";
import type { Bootstrap, Chapter, LockRule, Series, SeriesDetail } from "./types";

// The site's own logic, read straight from its src/lib (metro.config.js, tsconfig paths) so the app orders, names and searches
// exactly as the site does.
export { byFollowers, byPopularity, byThisWeek, byTopRated, byViews, popularityScore, ratingScore } from "@/lib/ranking";
export { chapterLabel } from "@/lib/chapter-label";
export { latestPerSeries } from "@/lib/latest-chapters";
export { pickEssentialGenres } from "@/lib/essential-genres";

/** The whole public catalogue in one call — the same one every page of the site starts from (cached ~15 s on the server). */
export function useBootstrap() {
  return useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => apiJson<Bootstrap>("/api/catalog/bootstrap"),
    staleTime: 60_000,
  });
}

export function useSeriesDetail(slug: string) {
  return useQuery({
    queryKey: ["series", slug],
    queryFn: () => apiJson<SeriesDetail>(`/api/catalog/series/${encodeURIComponent(slug)}`),
    staleTime: 30_000,
  });
}

/** Nothing shows as locked until the rule has loaded, and for visitors (the server refuses a locked page either way). */
const NO_LOCKS: LockRule = { lockedWindow: 0, freeFirstChapters: 3 };

export function useLockRule(): LockRule {
  const { status } = useSession();
  const { data } = useQuery({
    queryKey: ["lock-rule"],
    queryFn: () => apiJson<LockRule>("/api/wallet/rule"),
    enabled: status === "signedIn",
    staleTime: 5 * 60_000,
  });
  return data ?? NO_LOCKS;
}

/** The site's isLockedByRule (lib/chapter-lock.ts) for one chapter — it only decides what is shown. */
export function isLocked(chapter: Chapter, latestChapterNumber: number, rule: LockRule): boolean {
  return isLockedByRule(chapter.number, latestChapterNumber, rule, chapter.manualLock);
}

export function seriesTitle(series: Pick<Series, "title" | "titleAr">): string {
  return series.titleAr?.trim() || series.title;
}

/** The site's timeAgo (lib/utils.ts, which itself pulls in browser-only helpers, so this one function is repeated here). */
export function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} د`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${days} يوم`;
  const months = Math.floor(days / 30);
  if (months < 12) return `منذ ${months} شهر`;
  return `منذ ${Math.floor(months / 12)} سنة`;
}
