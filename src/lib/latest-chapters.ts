/**
 * "Latest chapters" lists show each work once. When a team publishes several chapters of the same series together, the
 * work appears a single time with its newest chapter, and `moreCount` says how many more came out in the same run
 * (chapters released within `BATCH_WINDOW_MS` of the newest one), so nothing is hidden, only folded.
 */
const BATCH_WINDOW_MS = 3 * 86_400_000;

export function latestPerSeries<T extends { seriesId: string; releasedAt: string }>(chapters: readonly T[], limit: number): (T & { moreCount: number })[] {
  const newestFirst = [...chapters].sort((a, b) => +new Date(b.releasedAt) - +new Date(a.releasedAt));
  const bySeries = new Map<string, T[]>();
  for (const chapter of newestFirst) {
    const group = bySeries.get(chapter.seriesId);
    if (group) group.push(chapter);
    else bySeries.set(chapter.seriesId, [chapter]);
  }
  return [...bySeries.values()].slice(0, limit).map(([newest, ...older]) => {
    const start = +new Date(newest.releasedAt) - BATCH_WINDOW_MS;
    return { ...newest, moreCount: older.filter((c) => +new Date(c.releasedAt) >= start).length };
  });
}
