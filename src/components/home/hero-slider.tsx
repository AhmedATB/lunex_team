"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Star, BookOpen, Play } from "lucide-react";
import type { Series } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
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
    <div className="relative h-[420px] w-full overflow-hidden rounded-3xl border border-white/10 sm:h-[480px] lg:h-[560px]">
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
          <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#09090B]/80 via-transparent to-transparent" />
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-6 sm:p-10">
        <motion.div
          key={`${current.id}-content`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="max-w-2xl space-y-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge>حصري LUNEX</Badge>
            <span className="flex items-center gap-1 text-sm font-semibold text-amber-300">
              <Star className="h-4 w-4 fill-amber-300" /> {current.rating}
            </span>
            <span className="text-sm text-lunex-gray">{formatNumber(current.views)} مشاهدة</span>
          </div>
          <h1 className="font-display text-3xl font-black text-white drop-shadow-lg sm:text-5xl">
            {current.titleAr}
          </h1>
          <p className="line-clamp-2 max-w-xl text-sm text-lunex-gray sm:text-base">{current.synopsis}</p>
          <div className="flex gap-3 pt-2">
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

        <div className="flex gap-1.5 pt-2">
          {series.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setIndex(i)}
              aria-label={`اذهب إلى ${s.titleAr}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? "w-8 bg-lunex-gradient" : "w-3 bg-white/20 hover:bg-white/40"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
