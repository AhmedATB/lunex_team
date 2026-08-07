import Image from "next/image";
import Link from "next/link";
import type { Series } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

/**
 * Crimson Blood's card: a "trading card" read — thick border, a clipped
 * diagonal corner, a bold stamped rank badge overlapping the edge. High
 * contrast, aggressive, built to feel like a ranked combatant roster.
 */
export function BloodCard({ series, rank }: { series: Series; rank?: number }) {
  return (
    <Link
      href={`/series/${series.slug}`}
      className="group relative flex aspect-[3/4] w-full overflow-hidden border-2 border-primary-700 bg-black transition-colors hover:border-primary-400"
      style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 14px 100%, 0 calc(100% - 14px))" }}
    >
      <Image
        src={series.cover}
        alt={series.titleAr}
        fill
        sizes="(max-width: 768px) 45vw, 16vw"
        className="object-cover opacity-75 grayscale-[30%] transition-all duration-500 group-hover:scale-105 group-hover:opacity-100 group-hover:grayscale-0"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent" />

      {rank !== undefined && (
        <span className="absolute start-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary-400 bg-black font-display text-sm font-black text-primary-300 shadow-[0_0_10px_rgba(220,38,38,0.6)]">
          {rank}
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 p-2.5">
        <p className="line-clamp-2 font-display text-sm font-black uppercase leading-tight text-white">
          {series.titleAr}
        </p>
        <p className="mt-1 text-[10px] font-bold text-primary-300">{formatNumber(series.views)} مشاهدة</p>
      </div>
    </Link>
  );
}
