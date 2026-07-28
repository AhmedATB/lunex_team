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
    <div className="relative">
      <div className="pointer-events-none absolute -inset-6 -z-10 opacity-70 blur-3xl" aria-hidden="true">
        <div className="h-full w-full rounded-[3rem] bg-lunex-gradient" />
      </div>

      <div className="relative h-[420px] w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-primary-950/60 sm:h-[480px] lg:h-[540px]">
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        <span className="sparkle h-2 w-2" style={{ top: "18%", left: "12%", animationDelay: "0s" }} />
        <span className="sparkle h-1.5 w-1.5" style={{ top: "30%", left: "78%", animationDelay: "1.1s" }} />
        <span className="sparkle h-2.5 w-2.5" style={{ top: "62%", left: "88%", animationDelay: "2s" }} />
        <span className="sparkle h-1.5 w-1.5" style={{ top: "72%", left: "8%", animationDelay: "0.6s" }} />
      </div>
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
            <span className="rounded-full bg-lunex-gradient px-3 py-1 text-xs font-bold text-white">
              حصري LUNEX
            </span>
            <span className="flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-sm font-bold text-amber-300 shadow-[0_0_16px_rgba(252,211,77,0.35)] backdrop-blur-sm">
              <Star className="h-4 w-4 fill-amber-300" /> {current.rating}
            </span>
            <span className="text-sm text-lunex-gray">{formatNumber(current.views)} مشاهدة</span>
          </div>
          <h1
            className="font-display text-4xl font-black leading-[1.05] text-white sm:text-6xl"
            style={{ textShadow: "0 2px 4px rgba(0,0,0,0.6), 0 0 40px rgba(168,85,247,0.5)" }}
          >
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
              className={`h-1.5 transition-all duration-300 ${
                i === index ? "w-8 bg-lunex-gradient" : "w-3 bg-white/20 hover:bg-white/40"
              }`}
            />
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
