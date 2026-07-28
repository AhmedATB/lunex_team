"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Star, BookOpen, Play } from "lucide-react";
import type { Series } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";

export function HeroSlider({ series }: { series: Series[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (series.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % series.length), 6000);
    return () => clearInterval(t);
  }, [series.length]);

  if (series.length === 0) return null;
  const current = series[index];

  return (
    <div className="relative h-[440px] w-full overflow-hidden sm:h-[500px] lg:h-[580px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
        >
          <Image
            src={current.banner}
            alt={current.titleAr}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/65 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#09090B]/85 via-transparent to-transparent" />
          <div
            className="absolute inset-0 opacity-25 mix-blend-overlay"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)",
              backgroundSize: "7px 7px",
              maskImage: "linear-gradient(to top, black, transparent 70%)",
            }}
          />
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-6 pb-10 sm:p-10 sm:pb-14">
        <motion.div
          key={`${current.id}-content`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="max-w-2xl space-y-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="-rotate-2 border-2 border-white bg-accent px-3 py-1 text-xs font-black text-accent-foreground shadow-[3px_3px_0_0_rgba(0,0,0,0.5)]">
              حصري LUNEX
            </span>
            <span className="flex items-center gap-1 border-2 border-white/20 bg-black/40 px-2 py-1 text-sm font-bold text-amber-300">
              <Star className="h-4 w-4 fill-amber-300" /> {current.rating}
            </span>
            <span className="text-sm text-lunex-gray">{formatNumber(current.views)} مشاهدة</span>
          </div>
          <h1
            className="font-display text-4xl font-black leading-[1.05] text-white sm:text-6xl"
            style={{ textShadow: "3px 3px 0 rgba(0,0,0,0.85)" }}
          >
            {current.titleAr}
          </h1>
          <p className="line-clamp-2 max-w-xl text-sm text-lunex-gray sm:text-base">{current.synopsis}</p>
          <div className="flex gap-3 pt-2">
            <Button size="lg" className="comic-btn" asChild>
              <Link href={`/series/${current.slug}`}>
                <Play className="h-4 w-4" /> ابدأ القراءة
              </Link>
            </Button>
            <Button size="lg" variant="secondary" className="comic-btn" asChild>
              <Link href={`/series/${current.slug}`}>
                <BookOpen className="h-4 w-4" /> التفاصيل
              </Link>
            </Button>
          </div>
        </motion.div>

        <div className="flex gap-1.5 pt-2">
          {series.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setIndex(i)}
              aria-label={`اذهب إلى ${s.titleAr}`}
              className={`h-1.5 transition-all duration-300 ${
                i === index ? "w-8 bg-lunex-gradient" : "w-3 bg-white/20 hover:bg-white/40"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
