import Link from "next/link";
import Image from "next/image";
import { timeAgo } from "@/lib/utils";
import type { Chapter, Series } from "@/lib/types";

/** Text-forward alternative to LatestChaptersGrid — a compact reading list rather than a card wall, for styles that lean editorial rather than image-heavy. */
export function LatestChaptersList({ chapters, title = "آخر تحديثات الفصول" }: { chapters: (Chapter & { series: Series })[]; title?: string }) {
  return (
    <section className="space-y-4">
      <h2 className="section-title font-display text-xl font-bold text-white sm:text-2xl">{title}</h2>
      <div className="panel divide-y divide-white/5">
        {chapters.map((c) => (
          <Link
            key={c.id}
            href={`/series/${c.series.slug}/${c.number}`}
            className="flex items-center gap-3 p-3 transition-colors hover:bg-primary-600/10"
          >
            <div className="relative h-14 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10">
              <Image src={c.series.cover} alt={c.series.titleAr} fill className="object-cover" sizes="44px" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-bold text-white">{c.series.titleAr}</p>
              <p className="text-xs text-primary-300">الفصل {c.number}</p>
            </div>
            <span className="shrink-0 text-[11px] text-lunex-gray">{timeAgo(c.releasedAt)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
