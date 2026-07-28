import Image from "next/image";
import Link from "next/link";
import { Star, BookOpen, Bookmark } from "lucide-react";
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
  "bg-primary-600 text-white",
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
      className="group ease-premium relative flex flex-col border-2 border-white/15 bg-[#150c26] shadow-[5px_5px_0_0_rgba(0,0,0,0.45)] transition-all duration-300 hover:-translate-y-1.5 hover:border-primary-400/60 hover:shadow-[7px_7px_0_0_rgba(109,40,217,0.55)] active:translate-y-0 active:shadow-[2px_2px_0_0_rgba(0,0,0,0.45)]"
    >
      <div
        className="relative aspect-[3/4] w-full overflow-hidden"
        style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 18% 100%, 0 84%)" }}
      >
        <Image
          src={series.cover}
          alt={series.titleAr}
          fill
          sizes="(max-width: 768px) 45vw, (max-width: 1200px) 22vw, 16vw"
          priority={priority}
          className="object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <Badge
          variant={STATUS_VARIANT[series.status]}
          className="absolute start-2 top-2 text-[10px]"
        >
          {STATUS_LABEL[series.status]}
        </Badge>
        <div className="absolute end-0 top-2 flex items-center gap-1 border-2 border-white bg-amber-400 px-2 py-0.5 text-xs font-black text-amber-950">
          <Star className="h-3 w-3 fill-amber-950" />
          {series.rating}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 border-t-2 border-white/15 p-2.5">
        {genreLabels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {genreLabels.map((label, i) => (
              <span
                key={label}
                className={cn(
                  "px-1.5 py-0.5 text-[9px] font-black leading-none",
                  GENRE_CHIP_STYLES[i % GENRE_CHIP_STYLES.length]
                )}
              >
                {label}
              </span>
            ))}
          </div>
        )}
        <h3 className="line-clamp-2 font-display text-sm font-black leading-snug text-white">
          {series.titleAr}
        </h3>
        <div className="mt-auto flex items-center gap-3 text-[11px] font-bold text-lunex-gray">
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
    <div className="flex flex-col border-2 border-white/10">
      <div
        className="aspect-[3/4] w-full animate-pulse bg-white/5"
        style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 18% 100%, 0 84%)" }}
      />
      <div className="h-16 animate-pulse border-t-2 border-white/10 bg-white/5" />
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
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {series.map((s) => (
          <SeriesCard key={s.id} series={s} />
        ))}
      </div>
    </section>
  );
}
