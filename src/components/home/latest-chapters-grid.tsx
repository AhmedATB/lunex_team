import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { genreLabelsFor, GENRE_CHIP_STYLES } from "@/lib/genre-helpers";
import { cn } from "@/lib/utils";
import type { Chapter, Series } from "@/lib/types";

export function LatestChaptersGrid({ chapters, title = "آخر تحديثات الفصول" }: { chapters: (Chapter & { series: Series })[]; title?: string }) {
  return (
    <section className="space-y-4">
      <h2 className="section-title font-display text-xl font-bold text-white sm:text-2xl">{title}</h2>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {chapters.map((c) => {
          const genreLabels = genreLabelsFor(c.series.genreIds);
          return (
            <Link
              key={c.id}
              href={`/series/${c.series.slug}/${c.number}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary-400/40 hover:shadow-xl hover:shadow-primary-900/30 active:border-primary-400/40 active:shadow-xl active:shadow-primary-900/30"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden">
                <Image
                  src={c.series.cover}
                  alt={c.series.titleAr}
                  fill
                  sizes="(max-width: 768px) 45vw, 16vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-110 group-active:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                <Badge className="absolute start-2 top-2 text-[10px]">جديد</Badge>
              </div>
              <div className="flex flex-1 flex-col gap-1.5 border-t border-white/5 bg-card p-2.5">
                {genreLabels.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {genreLabels.map((label, i) => (
                      <span
                        key={label}
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none",
                          GENRE_CHIP_STYLES[i % GENRE_CHIP_STYLES.length]
                        )}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
                <p className="line-clamp-1 font-display text-sm font-bold text-white">{c.series.titleAr}</p>
                <p className="mt-auto text-[11px] font-medium text-primary-300">الفصل {c.number}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
