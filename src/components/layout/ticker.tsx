"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";
import { getMockDatabase } from "@/lib/mock/generate";

export function Ticker() {
  const items = useMemo(() => {
    const db = getMockDatabase();
    const seriesMap = new Map(db.series.map((s) => [s.id, s]));
    return [...db.chapters]
      .sort((a, b) => +new Date(b.releasedAt) - +new Date(a.releasedAt))
      .slice(0, 10)
      .map((c) => ({ chapter: c, series: seriesMap.get(c.seriesId) }))
      .filter((i) => i.series);
  }, []);

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
