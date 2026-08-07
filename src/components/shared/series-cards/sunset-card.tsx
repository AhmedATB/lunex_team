import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import type { Series } from "@/lib/types";

/**
 * Hero Sunset's card: a cinematic poster — taller aspect ratio, large title
 * burned onto the bottom of the image itself under a warm gradient, almost
 * no separate info panel. Meant to feel like a movie poster wall, not a
 * catalog grid.
 */
export function SunsetCard({ series }: { series: Series; rank?: number }) {
  return (
    <Link
      href={`/series/${series.slug}`}
      className="group relative flex aspect-[3/5] w-full overflow-hidden rounded-xl shadow-lg shadow-black/50 transition-transform duration-300 hover:-translate-y-1"
    >
      <Image
        src={series.cover}
        alt={series.titleAr}
        fill
        sizes="(max-width: 768px) 45vw, 16vw"
        className="object-cover transition-transform duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 space-y-1 p-3">
        <span className="flex items-center gap-1 text-[11px] font-bold text-primary-300">
          <Star className="h-3 w-3 fill-primary-300" /> {series.rating}
        </span>
        <h3 className="line-clamp-2 font-display text-base font-black leading-tight text-white drop-shadow-lg">
          {series.titleAr}
        </h3>
      </div>
    </Link>
  );
}
