"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronLeft, CheckCircle2 } from "lucide-react";
import { useNovelReaderSettings, useReadingProgress } from "@/store/reader-settings";
import { useReaderChrome } from "@/store/reader-chrome";
import type { Chapter } from "@/lib/types";
import { cn } from "@/lib/utils";

const THEME_CLASSES: Record<string, string> = {
  sepia: "bg-[#f4ecd8] text-[#3b2f22]",
  light: "bg-white text-[#1a1a1a]",
  dark: "bg-[#15151a] text-[#e4e1d8]",
};

/** Arabic prose is read at roughly this many words a minute — only for the "minutes left" estimate. */
const READING_WORDS_PER_MINUTE = 180;

/** The progress dock's look on each reading background (the page itself is themed, so the dock has to follow). */
const DOCK_CLASSES: Record<string, string> = {
  sepia: "border-[#3b2f22]/15 bg-[#f4ecd8]/90 text-[#3b2f22]",
  light: "border-black/10 bg-white/90 text-[#1a1a1a]",
  dark: "border-white/10 bg-[#15151a]/90 text-[#e4e1d8]",
};

export function NovelViewer({
  seriesSlug,
  seriesId,
  chapter,
  prevChapter,
  nextChapter,
}: {
  seriesSlug: string;
  seriesId: string;
  chapter: Chapter;
  prevChapter?: number;
  nextChapter?: number;
}) {
  const { fontSize, theme } = useNovelReaderSettings();
  const setProgress = useReadingProgress((s) => s.setProgress);
  const toggleToolbar = useReaderChrome((s) => s.toggleToolbar);
  const containerRef = useRef<HTMLDivElement>(null);

  const paragraphs = (chapter.content ?? "").split(/\n{2,}/).filter(Boolean);
  const minutesTotal = useMemo(() => {
    const words = (chapter.content ?? "").split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / READING_WORDS_PER_MINUTE));
  }, [chapter.content]);

  useEffect(() => {
    setProgress(seriesId, chapter.number);
  }, [seriesId, chapter.number, setProgress]);

  const [scrollProgress, setScrollProgress] = useState(0);
  useEffect(() => {
    function onScroll() {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      if (total <= 0) {
        setScrollProgress(1);
        return;
      }
      setScrollProgress(Math.min(1, Math.max(0, -rect.top / total)));
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const percent = Math.min(100, Math.round(scrollProgress * 100));
  const minutesLeft = Math.max(0, Math.ceil(minutesTotal * (1 - scrollProgress)));
  const finished = scrollProgress >= 0.98;

  return (
    <div className={cn("min-h-screen transition-colors duration-300", THEME_CLASSES[theme])}>
      <div className="fixed inset-x-0 top-0 z-40 h-1 bg-black/10">
        <div
          className="h-full bg-lunex-gradient transition-all duration-200"
          style={{ width: `${scrollProgress * 100}%` }}
        />
      </div>

      {/* How far along, and what is left — always in reach, and it turns into "finished" at the end. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
        <div
          dir="rtl"
          className={cn(
            "pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border px-4 py-2.5 text-sm shadow-lg backdrop-blur-md transition-colors duration-300",
            DOCK_CLASSES[theme],
            finished && "border-emerald-500/40"
          )}
        >
          {finished ? (
            <>
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" aria-hidden />
              <span className="font-bold" role="status">
                أنهيت الفصل
              </span>
              {nextChapter ? (
                <Link
                  href={`/series/${seriesSlug}/${nextChapter}`}
                  className="ms-auto flex items-center gap-1 rounded-xl bg-lunex-gradient px-3 py-1.5 text-xs font-bold text-white"
                >
                  الفصل التالي <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-0" />
                </Link>
              ) : (
                <Link href={`/series/${seriesSlug}`} className="ms-auto rounded-xl px-3 py-1.5 text-xs font-bold opacity-80 hover:opacity-100">
                  فهرس الرواية
                </Link>
              )}
            </>
          ) : (
            <>
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-current/15"
                role="progressbar"
                aria-label="التقدّم في الفصل"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
              >
                <div className="h-full rounded-full bg-lunex-gradient transition-all duration-200" style={{ width: `${percent}%` }} />
              </div>
              <span className="w-10 shrink-0 text-center font-bold tabular-nums" dir="ltr">
                {percent}%
              </span>
              <span className="shrink-0 text-xs opacity-75">باقي ≈ {minutesLeft} د</span>
            </>
          )}
        </div>
      </div>

      <div ref={containerRef} dir="rtl" className="mx-auto max-w-[70ch] px-6 pb-28 pt-12" onClick={toggleToolbar}>
        <h1 className="mb-8 text-center font-display text-2xl font-bold">{chapter.title}</h1>

        <div
          className="space-y-6"
          style={{ fontSize: `${fontSize}px`, lineHeight: 1.95 }}
        >
          {paragraphs.length > 0 ? (
            paragraphs.map((p, i) => (
              <p key={i} className="text-justify">
                {p}
              </p>
            ))
          ) : (
            <p className="text-center opacity-60">لا يوجد نص لهذا الفصل بعد.</p>
          )}
        </div>

        <div className="mt-16 flex items-center justify-between gap-3 border-t border-current/10 pt-6">
          {prevChapter ? (
            <Link
              href={`/series/${seriesSlug}/${prevChapter}`}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold opacity-80 transition-opacity hover:opacity-100"
            >
              <ChevronRight className="h-4 w-4 rtl:rotate-180" /> الفصل السابق
            </Link>
          ) : (
            <span />
          )}
          <Link
            href={`/series/${seriesSlug}`}
            className="rounded-xl px-4 py-2.5 text-sm font-bold opacity-80 transition-opacity hover:opacity-100"
          >
            فهرس الرواية
          </Link>
          {nextChapter ? (
            <Link
              href={`/series/${seriesSlug}/${nextChapter}`}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold opacity-80 transition-opacity hover:opacity-100"
            >
              الفصل التالي <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            </Link>
          ) : (
            <span />
          )}
        </div>
      </div>
    </div>
  );
}
