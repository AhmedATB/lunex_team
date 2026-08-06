import Link from "next/link";
import Image from "next/image";
import { formatNumber } from "@/lib/utils";
import type { Series } from "@/lib/types";

/** Leaderboard-style alternative to TrendingCarousel — a dense ranked grid with oversized numbers, for styles that want a competitive, high-density "wall" feel instead of a scrolling row. */
export function TrendingRankGrid({ series, title = "الرائجة", href = "/search?sort=views" }: { series: Series[]; title?: string; href?: string }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title font-display text-xl font-bold text-white sm:text-2xl">{title}</h2>
        <Link href={href} className="text-sm font-medium text-primary-300 hover:text-primary-200">
          عرض الكل ←
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {series.map((s, i) => (
          <Link
            key={s.id}
            href={`/series/${s.slug}`}
            className="group relative flex overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary-400/50"
          >
            <div className="relative aspect-[3/4] w-full overflow-hidden">
              <Image
                src={s.cover}
                alt={s.titleAr}
                fill
                sizes="(max-width: 768px) 45vw, 20vw"
                className="object-cover opacity-70 transition-all duration-500 group-hover:scale-110 group-hover:opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
              <span className="absolute -bottom-3 -start-1 font-display text-6xl font-black text-primary-400/40">
                {i + 1}
              </span>
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="line-clamp-1 font-display text-sm font-bold text-white">{s.titleAr}</p>
                <p className="text-[11px] text-lunex-gray">{formatNumber(s.views)} مشاهدة</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
