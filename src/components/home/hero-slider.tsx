"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Star, BookOpen, Play } from "lucide-react";
import type { Series } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn, formatNumber } from "@/lib/utils";

const SLOT_SIZE_CLASS = [
  "w-[128px] h-[176px] sm:w-[168px] sm:h-[230px] lg:w-[220px] lg:h-[300px] xl:w-[280px] xl:h-[374px] 2xl:w-[320px] 2xl:h-[427px]",
  "w-[66px] h-[92px] sm:w-[100px] sm:h-[136px] lg:w-[176px] lg:h-[235px] xl:w-[224px] xl:h-[299px] 2xl:w-[256px] 2xl:h-[341px]",
  "hidden sm:block sm:w-[64px] sm:h-[88px] lg:w-[132px] lg:h-[176px] xl:w-[168px] xl:h-[224px] 2xl:w-[192px] 2xl:h-[256px]",
];

export function HeroSlider({ series }: { series: Series[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (series.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % series.length), 6000);
    return () => clearInterval(t);
  }, [series.length]);

  const sideCount = series.length > 0 ? Math.min(2, Math.floor((series.length - 1) / 2)) : 0;

  const slots = useMemo(() => {
    const arr: { offset: number; series: Series }[] = [];
    if (series.length === 0) return arr;
    for (let o = -sideCount; o <= sideCount; o++) {
      const i = (((index + o) % series.length) + series.length) % series.length;
      arr.push({ offset: o, series: series[i] });
    }
    return arr;
  }, [index, sideCount, series]);

  if (series.length === 0) return null;
  const current = series[index];

  function goTo(offset: number) {
    setIndex((prev) => (((prev + offset) % series.length) + series.length) % series.length);
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-6 -z-10 opacity-70 blur-3xl" aria-hidden="true">
        <div className="h-full w-full rounded-[3rem] bg-lunex-gradient" />
      </div>

      <div className="flex items-end justify-center gap-2 py-2 sm:gap-4">
        {slots.map(({ offset, series: s }) => {
          const dist = Math.abs(offset);
          const sizeClass = SLOT_SIZE_CLASS[dist];

          const cover = (
            <>
              <AnimatePresence initial={false}>
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="absolute inset-0"
                >
                  <Image
                    src={s.cover}
                    alt={s.titleAr}
                    fill
                    sizes="(max-width: 640px) 30vw, 220px"
                    priority={dist === 0}
                    className="object-cover"
                  />
                </motion.div>
              </AnimatePresence>

              {dist === 0 ? (
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      offset < 0
                        ? "linear-gradient(to left, transparent 35%, #09090B 100%)"
                        : "linear-gradient(to right, transparent 35%, #09090B 100%)",
                  }}
                />
              )}
            </>
          );

          if (dist === 0) {
            return (
              <div
                key={offset}
                className={cn(
                  "relative z-10 shrink-0 overflow-hidden rounded-2xl shadow-2xl shadow-primary-950/60 ring-1 ring-white/15",
                  sizeClass
                )}
              >
                {cover}
              </div>
            );
          }

          return (
            <button
              key={offset}
              type="button"
              onClick={() => goTo(offset)}
              aria-label={`اذهب إلى ${s.titleAr}`}
              className={cn(
                "relative shrink-0 cursor-pointer overflow-hidden rounded-2xl opacity-80 transition-all duration-500 hover:opacity-100 hover:brightness-110",
                sizeClass
              )}
            >
              {cover}
            </button>
          );
        })}
      </div>

      <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-4 pb-2 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
            className="space-y-3"
          >
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full bg-lunex-gradient px-3 py-1 text-xs font-bold text-white">
                حصري LUNEX
              </span>
              <span className="flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-sm font-bold text-amber-300 shadow-[0_0_16px_rgba(252,211,77,0.35)] backdrop-blur-sm">
                <Star className="h-4 w-4 fill-amber-300" /> {current.rating}
              </span>
              <span className="text-sm text-lunex-gray">{formatNumber(current.views)} مشاهدة</span>
            </div>
            <h1
              className="font-display text-3xl font-black leading-[1.05] text-white sm:text-5xl"
              style={{ textShadow: "0 2px 4px rgba(0,0,0,0.6), 0 0 40px rgba(168,85,247,0.5)" }}
            >
              {current.titleAr}
            </h1>
            <p className="line-clamp-2 text-sm text-lunex-gray sm:text-base">{current.synopsis}</p>
            <div className="flex justify-center gap-3 pt-1">
              <Button size="lg" asChild>
                <Link href={`/series/${current.slug}`}>
                  <Play className="h-4 w-4" /> ابدأ القراءة
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link href={`/series/${current.slug}`}>
                  <BookOpen className="h-4 w-4" /> التفاصيل
                </Link>
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>

        {series.length > 1 && (
          <div className="flex gap-1.5 pt-1">
            {series.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setIndex(i)}
                aria-label={`اذهب إلى ${s.titleAr}`}
                className={cn(
                  "h-1.5 transition-all duration-300",
                  i === index ? "w-8 bg-lunex-gradient" : "w-3 bg-white/20 hover:bg-white/40"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
