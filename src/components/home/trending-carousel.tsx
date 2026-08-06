import Link from "next/link";
import Image from "next/image";
import { genreLabelsFor, GENRE_CHIP_STYLES } from "@/lib/genre-helpers";
import { cn } from "@/lib/utils";
import type { Series } from "@/lib/types";

export function TrendingCarousel({ series, title = "الرائجة", href = "/search?sort=views" }: { series: Series[]; title?: string; href?: string }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title font-display text-xl font-bold text-white sm:text-2xl">{title}</h2>
        <Link href={href} className="text-sm font-medium text-primary-300 hover:text-primary-200">
          عرض الكل ←
        </Link>
      </div>
      <div className="no-scrollbar flex gap-5 overflow-x-auto pb-2">
        {series.map((s, i) => {
          const genreLabels = genreLabelsFor(s.genreIds);
          return (
            <Link
              key={s.id}
              href={`/series/${s.slug}`}
              className="group relative flex w-40 shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary-400/40 hover:shadow-xl hover:shadow-primary-900/30 active:border-primary-400/40 active:shadow-xl active:shadow-primary-900/30 sm:w-48"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden">
                <span className="absolute start-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-lunex-gradient font-display text-sm font-black text-white">
                  {i + 1}
                </span>
                <Image
                  src={s.cover}
                  alt={s.titleAr}
                  fill
                  sizes="160px"
                  className="object-cover transition-transform duration-500 group-hover:scale-110 group-active:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              </div>
              <div className="flex flex-1 flex-col gap-1.5 border-t border-white/5 bg-card p-2.5">
                {genreLabels.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {genreLabels.map((label, gi) => (
                      <span
                        key={label}
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none",
                          GENRE_CHIP_STYLES[gi % GENRE_CHIP_STYLES.length]
                        )}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
                <p className="line-clamp-2 font-display text-xs font-bold text-white">{s.titleAr}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
