"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";
import { useCatalog } from "@/components/catalog-provider";
import { latestPerSeries } from "@/lib/latest-chapters";

export function Ticker() {
  const db = useCatalog();
  const items = useMemo(() => {
    const seriesMap = new Map(db.series.map((s) => [s.id, s]));
    // One entry per work: several chapters released together are one item, not one each.
    return latestPerSeries(
      db.recentChapters.filter((c) => seriesMap.has(c.seriesId)),
      10
    ).map((c) => ({ chapter: c, series: seriesMap.get(c.seriesId) }));
  }, [db.series, db.recentChapters]);

  if (items.length === 0) return null;

  const row = (
    <>
      {items.map(({ chapter, series }) => (
        <Link
          key={chapter.id}
          href={`/series/${series!.slug}/${chapter.number}`}
          className="group flex shrink-0 items-center gap-2 border-l border-white/10 px-5 py-1.5 text-white/70 transition-colors hover:bg-white/5 hover:text-white"
        >
          <Zap className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
          <span className="whitespace-nowrap text-xs font-medium">
            <span className="font-bold text-amber-300">جديد:</span> {series!.titleAr} — الفصل {chapter.number}
            {chapter.moreCount > 0 && ` (+${chapter.moreCount})`}
          </span>
        </Link>
      ))}
    </>
  );

  return (
    <div dir="ltr" className="overflow-hidden border-b border-white/10 bg-black/30 backdrop-blur-sm">
      <div className="marquee-track">
        {row}
        {row}
      </div>
    </div>
  );
}
