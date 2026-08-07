import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import type { Series } from "@/lib/types";
import { genreLabelsFor } from "@/lib/genre-helpers";

/** Ink & Paper's card: not a card at all — a compact reading-list row, matching the editorial, text-forward feel of the rest of that layout. */
export function PaperListItem({ series }: { series: Series; rank?: number }) {
  const genreLabels = genreLabelsFor(series.genreIds);
  return (
    <Link href={`/series/${series.slug}`} className="group flex items-center gap-3 border-b border-white/5 py-2.5 last:border-0">
      <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10">
        <Image src={series.cover} alt={series.titleAr} fill className="object-cover" sizes="48px" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-display text-sm font-bold text-white group-hover:text-primary-300">
          {series.titleAr}
        </h3>
        <p className="truncate text-[11px] text-lunex-gray">{genreLabels.join(" · ") || series.author}</p>
      </div>
      <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary-300">
        <Star className="h-3 w-3 fill-primary-300" /> {series.rating}
      </span>
    </Link>
  );
}
