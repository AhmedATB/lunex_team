import Image from "next/image";
import Link from "next/link";
import { Star, BookOpen, Bookmark, Sparkle } from "lucide-react";
import type { Series } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn, formatNumber } from "@/lib/utils";
import { getMockDatabase } from "@/lib/mock/generate";

const STATUS_LABEL: Record<Series["status"], string> = {
  ongoing: "مستمر",
  completed: "مكتمل",
  hiatus: "متوقف مؤقتاً",
  dropped: "متروك",
};

const STATUS_VARIANT: Record<Series["status"], "success" | "secondary" | "warning" | "destructive"> = {
  ongoing: "success",
  completed: "secondary",
  hiatus: "warning",
  dropped: "destructive",
};

export const genreNameById = new Map(getMockDatabase().genres.map((g) => [g.id, g.nameAr]));

export const GENRE_CHIP_STYLES = [
  "bg-primary-600/90 text-white",
  "bg-amber-400 text-amber-950",
  "bg-[#c084fc] text-[#2c0a4d]",
];

export function genreLabelsFor(genreIds: string[], limit = 3): string[] {
  return genreIds
    .slice(0, limit)
    .map((id) => genreNameById.get(id))
    .filter(Boolean) as string[];
}

export function SeriesCard({ series, priority = false }: { series: Series; priority?: boolean }) {
  const genreLabels = genreLabelsFor(series.genreIds);

  return (
    <Link
      href={`/series/${series.slug}`}
      className="art-glow ease-bounce group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#120a1f] transition-all duration-300 hover:-translate-y-2 hover:rotate-[-0.75deg] hover:border-primary-400/50 hover:shadow-2xl hover:shadow-primary-900/40"
    >
      <div className="shine relative aspect-[3/4] w-full overflow-hidden">
        <Image
          src={series.cover}
          alt={series.titleAr}
          fill
          sizes="(max-width: 768px) 45vw, (max-width: 1200px) 22vw, 16vw"
          priority={priority}
          className="object-cover transition-all duration-500 group-hover:scale-110 group-hover:saturate-[1.15] group-hover:brightness-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        <Badge variant={STATUS_VARIANT[series.status]} className="absolute start-2 top-2 text-[10px]">
          {STATUS_LABEL[series.status]}
        </Badge>
        <div className="ease-bounce absolute end-2 top-2 flex rotate-3 items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.3)] backdrop-blur-sm transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-110">
          <Star className="h-3 w-3 fill-amber-300" />
          {series.rating}
        </div>

        {/* Sparkle burst — hidden until hover, three staggered points that pop in like fairy dust. */}
        <Sparkle
          className="ease-bounce pointer-events-none absolute bottom-3 start-3 h-4 w-4 scale-0 fill-primary-300 text-primary-300 opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100"
          style={{ transitionDelay: "0ms" }}
        />
        <Sparkle
          className="ease-bounce pointer-events-none absolute bottom-8 start-8 h-3 w-3 scale-0 fill-amber-300 text-amber-300 opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100"
          style={{ transitionDelay: "80ms" }}
        />
        <Sparkle
          className="ease-bounce pointer-events-none absolute bottom-4 start-12 h-2.5 w-2.5 scale-0 fill-pink-300 text-pink-300 opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100"
          style={{ transitionDelay: "150ms" }}
        />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 border-t border-white/5 bg-[#150c26] p-2.5">
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
        <h3 className="line-clamp-2 font-display text-sm font-bold leading-snug text-white">
          {series.titleAr}
        </h3>
        <div className="mt-auto flex items-center gap-3 text-[11px] font-medium text-lunex-gray">
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" /> {series.latestChapterNumber}
          </span>
          <span className="flex items-center gap-1">
            <Bookmark className="h-3 w-3" /> {formatNumber(series.bookmarks)}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function SeriesCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10">
      <div className="aspect-[3/4] w-full animate-pulse bg-white/5" />
      <div className="h-16 animate-pulse border-t border-white/5 bg-white/5" />
    </div>
  );
}

export function SeriesRow({
  title,
  href,
  series,
  className,
}: {
  title: string;
  href?: string;
  series: Series[];
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-white sm:text-2xl">{title}</h2>
        {href && (
          <Link href={href} className="text-sm font-medium text-primary-300 hover:text-primary-200">
            عرض الكل ←
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {series.map((s) => (
          <SeriesCard key={s.id} series={s} />
        ))}
      </div>
    </section>
  );
}
