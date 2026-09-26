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
          className="group flex shrink-0 items-center gap-2 border-l border-black/10 px-5 py-2 font-bold text-[#1a0b2e] transition-colors hover:bg-black/10"
        >
          <Zap className="h-4 w-4 shrink-0 fill-current" />
          <span className="whitespace-nowrap text-sm">
            جديد: {series!.titleAr} — الفصل {chapter.number}
            {chapter.moreCount > 0 && ` (+${chapter.moreCount})`}
          </span>
        </Link>
      ))}
    </>
  );

  return (
    <div dir="ltr" className="overflow-hidden border-b-2 border-white/20 bg-amber-400">
      <div className="marquee-track">
        {row}
        {row}
      </div>
    </div>
  );
}
