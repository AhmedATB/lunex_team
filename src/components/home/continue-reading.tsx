"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import type { Series } from "@/lib/types";
import { useReadingProgress } from "@/store/reader-settings";
import { getMockDatabase } from "@/lib/mock/generate";

export function ContinueReading() {
  const progress = useReadingProgress((s) => s.progress);
  const [items, setItems] = useState<{ series: Series; chapter: number }[]>([]);

  useEffect(() => {
    const db = getMockDatabase();
    const entries = Object.entries(progress);
    const list = entries
      .map(([seriesId, chapter]) => {
        const series = db.series.find((s) => s.id === seriesId);
        return series ? { series, chapter } : null;
      })
      .filter(Boolean) as { series: Series; chapter: number }[];
    setItems(list.slice(0, 6));
  }, [progress]);

  if (items.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-bold text-white sm:text-2xl">تابع القراءة</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {items.map(({ series, chapter }) => (
          <Link
            key={series.id}
            href={`/series/${series.slug}/${chapter}`}
            className="group relative overflow-hidden rounded-2xl border border-white/10"
          >
            <div className="relative aspect-[3/4.2] w-full">
              <Image src={series.cover} alt={series.titleAr} fill className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
              {/* Always at least a little visible — on touch there's no hover to reveal
                  this "tap to continue" affordance, so it can't be opacity-0 by default. */}
              <div className="absolute inset-0 flex items-center justify-center opacity-70 transition-opacity group-hover:opacity-100 group-active:opacity-100">
                <div className="rounded-full bg-lunex-gradient p-3 shadow-[0_0_20px_rgba(168,85,247,0.5)]">
                  <Play className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="line-clamp-1 text-xs font-bold text-white">{series.titleAr}</p>
                <p className="text-[11px] text-primary-300">الفصل {chapter}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
