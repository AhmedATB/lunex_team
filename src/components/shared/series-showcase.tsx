import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Series } from "@/lib/types";

/**
 * The layout-neutral half of "how a row of series is shown": header + grid
 * shell, identical across every style. What actually makes each style's
 * series display look different is the `renderCard` function each layout
 * passes in (see components/shared/series-cards/) — this wrapper never
 * knows or cares which card design it's holding.
 */
export function SeriesShowcase({
  title,
  href,
  series,
  renderCard,
  className,
  gridClassName,
}: {
  title: string;
  href?: string;
  series: Series[];
  renderCard: (series: Series, index: number) => React.ReactNode;
  className?: string;
  gridClassName?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h2 className="section-title font-display text-xl font-bold text-white sm:text-2xl">{title}</h2>
        {href && (
          <Link href={href} className="text-sm font-medium text-primary-300 hover:text-primary-200">
            عرض الكل ←
          </Link>
        )}
      </div>
      <div className={cn("grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6", gridClassName)}>
        {series.map((s, i) => renderCard(s, i))}
      </div>
    </section>
  );
}
