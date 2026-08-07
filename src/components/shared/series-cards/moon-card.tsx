import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import type { Series } from "@/lib/types";

/**
 * Blue Moon's card: soft and understated — no heavy gradient burned onto
 * the image, no glow/shine effects, info sits calmly below in a clean
 * typographic block with generous padding. A gallery card, not a poster.
 */
export function MoonCard({ series }: { series: Series; rank?: number }) {
  return (
    <Link href={`/series/${series.slug}`} className="group flex flex-col gap-2.5">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-white/10 transition-colors group-hover:border-primary-400/40">
        <Image
          src={series.cover}
          alt={series.titleAr}
          fill
          sizes="(max-width: 768px) 45vw, 16vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="space-y-0.5 px-0.5">
        <h3 className="line-clamp-1 font-display text-sm font-semibold text-white">{series.titleAr}</h3>
        <span className="flex items-center gap-1 text-[11px] text-lunex-gray">
          <Star className="h-3 w-3 fill-primary-300 text-primary-300" /> {series.rating}
        </span>
      </div>
    </Link>
  );
}
