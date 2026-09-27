/** Resuming a chapter, and the per-chapter checkmarks/progress bars of a chapter list — all through the site's own API. */

export interface ChapterProgress {
  fraction: number;
  finished: boolean;
}

/** Where to resume this chapter (0 for one already finished — nothing to resume there). Silent on failure: worst case, it opens at the top. */
export async function fetchPosition(chapterId: string): Promise<ChapterProgress | null> {
  try {
    const res = await fetch(`/api/me/reading/position?chapterId=${encodeURIComponent(chapterId)}`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as ChapterProgress) : null;
  } catch {
    return null;
  }
}

/** A ping of where the reader has scrolled to. Fire-and-forget: never awaited by the caller, never surfaced as an error. */
export function savePosition(chapterId: string, fraction: number): void {
  fetch("/api/me/reading/position", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chapterId, fraction }),
    keepalive: true,
  }).catch(() => {});
}

/** Every chapter of one work the reader has touched, by chapter id. Empty when signed out or the request fails. */
export async function fetchSeriesProgress(seriesId: string): Promise<Record<string, ChapterProgress>> {
  try {
    const res = await fetch(`/api/me/reading/progress?seriesId=${encodeURIComponent(seriesId)}`, { cache: "no-store" });
    if (!res.ok) return {};
    const body: { items: ({ chapterId: string } & ChapterProgress)[] } = await res.json();
    return Object.fromEntries(body.items.map(({ chapterId, ...p }) => [chapterId, p]));
  } catch {
    return {};
  }
}
