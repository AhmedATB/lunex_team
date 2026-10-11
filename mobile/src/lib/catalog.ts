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

/** Arabic-friendly relative time: "منذ 3 ساعات". */
export function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} د`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${days} يوم`;
  return new Date(iso).toLocaleDateString("ar");
}
