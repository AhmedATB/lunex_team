"use client";

import { useMemo } from "react";
import Image from "next/image";
import { useCatalog } from "@/components/catalog-provider";
import { cn } from "@/lib/utils";

const PER_COLUMN = 6;

/**
 * Three slanted columns of real series covers drifting in opposite directions — the shop window behind the
 * sign-in pages. Only covers of the real catalogue and of "safe" works are used; with too few of them (a fresh
 * database, the built-in sample data) nothing is drawn and the page falls back to its plain backdrop.
 * Decorative: hidden from assistive technology, still under reduced motion.
 */
export function CoverWall({ className, columns = 3 }: { className?: string; columns?: 2 | 3 }) {
  const { series } = useCatalog();

  const cols = useMemo(() => {
    const usable = series
      .filter((s) => s.cover.startsWith("/api/catalog/") && (s.contentRating ?? "safe") === "safe")
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, PER_COLUMN * columns);
    if (usable.length < columns * 3) return [];
    return Array.from({ length: columns }, (_, c) => usable.filter((_, i) => i % columns === c));
  }, [series, columns]);

  if (cols.length === 0) return null;

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <div className="absolute -inset-x-[20%] -inset-y-[15%] flex -rotate-[9deg] justify-center gap-3 sm:gap-4">
        {cols.map((covers, c) => (
          <div key={c} className="w-[42%] max-w-[210px] sm:w-[30%]" style={{ marginTop: c === 1 ? "-9rem" : c === 2 ? "-3rem" : 0 }}>
            <div
              className={c % 2 === 0 ? "wall-col-up flex flex-col gap-3 sm:gap-4" : "wall-col-down flex flex-col gap-3 sm:gap-4"}
              style={{ ["--wall-speed" as string]: `${70 + c * 14}s` }}
            >
              {/* the list twice, so moving it by half its height loops without a seam */}
              {[...covers, ...covers].map((s, i) => (
                <div key={`${s.id}-${i}`} className="relative aspect-[2/3] overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10 shadow-lg shadow-black/40">
                  <Image src={s.cover} alt="" fill sizes="210px" className="object-cover" unoptimized loading={i < 2 ? "eager" : "lazy"} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
