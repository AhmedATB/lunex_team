import Image from "next/image";
import Link from "next/link";
import { Star, BookOpen, Bookmark } from "lucide-react";
import type { Series } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn, formatNumber } from "@/lib/utils";

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

function tiltFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 5) - 2) * 0.6;
}

export function SeriesCard({ series, priority = false }: { series: Series; priority?: boolean }) {
  const tilt = tiltFor(series.id);

  return (
    <Link
      href={`/series/${series.slug}`}
      className="group ease-premium relative flex flex-col overflow-hidden border-2 border-white/15 bg-[#150c26] shadow-[5px_5px_0_0_rgba(0,0,0,0.45)] transition-all duration-300 hover:-translate-y-1.5 hover:border-primary-400/60 hover:shadow-[7px_7px_0_0_rgba(109,40,217,0.55)] active:translate-y-0 active:shadow-[2px_2px_0_0_rgba(0,0,0,0.45)]"
      style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 12% 100%, 0 88%)", transform: `rotate(${tilt}deg)` }}
    >
      <div className="relative aspect-[3/4.2] w-full overflow-hidden">
        <Image
          src={series.cover}
          alt={series.titleAr}
          fill
          sizes="(max-width: 768px) 45vw, (max-width: 1200px) 22vw, 16vw"
          priority={priority}
          className="object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
        <Badge
          variant={STATUS_VARIANT[series.status]}
          className="absolute start-2 top-2 rounded-none border-2 border-white/80 font-black shadow-[2px_2px_0_0_rgba(0,0,0,0.5)]"
        >
          {STATUS_LABEL[series.status]}
        </Badge>
        <div className="absolute end-0 top-2 flex -rotate-3 items-center gap-1 border-2 border-white bg-amber-400 px-2 py-0.5 text-xs font-black text-amber-950 shadow-[2px_2px_0_0_rgba(0,0,0,0.5)]">
          <Star className="h-3 w-3 fill-amber-950" />
          {series.rating}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-3">
          <h3 className="line-clamp-2 font-display text-sm font-black text-white">{series.titleAr}</h3>
          <div className="flex items-center gap-3 text-[11px] font-bold text-lunex-gray">
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" /> {series.latestChapterNumber}
            </span>
            <span className="flex items-center gap-1">
              <Bookmark className="h-3 w-3" /> {formatNumber(series.bookmarks)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function SeriesCardSkeleton() {
  return (
    <div
      className="aspect-[3/4.2] w-full animate-pulse border-2 border-white/10 bg-white/5"
      style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 12% 100%, 0 88%)" }}
    />
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
