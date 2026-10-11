import { useQuery } from "@tanstack/react-query";
import { apiJson } from "./api";
import { useSession } from "./session";
import type { Bootstrap, Chapter, LockRule, Series, SeriesDetail } from "./types";

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

/** Mirrors the server's rule (backend wallet.config.ts isLockedByRule) — it only decides what is shown. */
export function isLocked(chapter: Chapter, latestChapterNumber: number, rule: LockRule): boolean {
  if (chapter.manualLock === true) return true;
  if (chapter.manualLock === false) return false;
  if (rule.lockedWindow <= 0) return false;
  if (chapter.number <= rule.freeFirstChapters) return false;
  return chapter.number > latestChapterNumber - rule.lockedWindow;
}

/** Same rule as the site's chapter-label.ts: the number always shows, the title after it, never the number twice. */
export function chapterLabel(chapter: { number: number; title?: string | null }): string {
  const title = (chapter.title ?? "").trim();
  if (!title) return `الفصل ${chapter.number}`;
  const number = String(chapter.number).replace(/\./g, "\\.");
  return new RegExp(`(^|[^0-9.])${number}([^0-9]|$)`).test(title) ? title : `الفصل ${chapter.number} — ${title}`;
}

export function seriesTitle(series: Pick<Series, "title" | "titleAr">): string {
  return series.titleAr?.trim() || series.title;
}

/** The site's timeAgo (lib/utils.ts). */
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

export { byFollowers, byPopularity, byThisWeek, byTopRated, byViews, popularityScore, ratingScore } from "./ranking";

/** The site's lib/latest-chapters.ts: each work's newest chapter, and how many more came in the 3 days before it. */
const BATCH_WINDOW_MS = 3 * 86_400_000;
export function latestPerSeries<T extends { seriesId: string; releasedAt: string }>(chapters: readonly T[], limit: number): (T & { moreCount: number })[] {
  const newestFirst = [...chapters].sort((a, b) => +new Date(b.releasedAt) - +new Date(a.releasedAt));
  const bySeries = new Map<string, T[]>();
  for (const chapter of newestFirst) {
    const group = bySeries.get(chapter.seriesId);
    if (group) group.push(chapter);
    else bySeries.set(chapter.seriesId, [chapter]);
  }
  return [...bySeries.values()].slice(0, limit).map(([latest, ...older]) => {
    const start = +new Date(latest.releasedAt) - BATCH_WINDOW_MS;
    return { ...latest, moreCount: older.filter((c) => +new Date(c.releasedAt) >= start).length };
  });
}
