import Image from "next/image";
import Link from "next/link";
import { Star, Eye } from "lucide-react";
import type { Series } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

/**
 * Neon Cyber's card: sharp corners, HUD-style bracket frame, info burned
 * directly onto the image (no separate panel below) for a dense "terminal
 * screen" read rather than a soft poster.
 */
export function CyberCard({ series, rank }: { series: Series; rank?: number }) {
  return (
    <Link
      href={`/series/${series.slug}`}
      className="group relative flex aspect-[3/4] w-full overflow-hidden border border-primary-400/30 transition-colors hover:border-primary-400"
    >
      <Image
        src={series.cover}
        alt={series.titleAr}
        fill
        sizes="(max-width: 768px) 45vw, 16vw"
        className="object-cover opacity-80 transition-all duration-500 group-hover:scale-105 group-hover:opacity-100"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/10" />

      {/* corner brackets */}
      <span className="pointer-events-none absolute start-1.5 top-1.5 h-3 w-3 border-s-2 border-t-2 border-primary-400" />
      <span className="pointer-events-none absolute end-1.5 top-1.5 h-3 w-3 border-e-2 border-t-2 border-primary-400" />
      <span className="pointer-events-none absolute bottom-1.5 start-1.5 h-3 w-3 border-b-2 border-s-2 border-primary-400" />
      <span className="pointer-events-none absolute bottom-1.5 end-1.5 h-3 w-3 border-b-2 border-e-2 border-primary-400" />

      {rank !== undefined && (
        <span className="absolute start-2 top-2 font-mono text-[11px] font-bold text-primary-300">
          [{String(rank).padStart(2, "0")}]
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 space-y-1 p-2.5">
        <p className="line-clamp-2 font-display text-xs font-bold text-white">{series.titleAr}</p>
        <div className="flex items-center gap-2 font-mono text-[10px] text-primary-300">
          <span className="flex items-center gap-0.5">
            <Star className="h-2.5 w-2.5 fill-primary-300" /> {series.rating}
          </span>
          <span className="flex items-center gap-0.5">
            <Eye className="h-2.5 w-2.5" /> {formatNumber(series.views)}
          </span>
        </div>
      </div>
    </Link>
  );
}
