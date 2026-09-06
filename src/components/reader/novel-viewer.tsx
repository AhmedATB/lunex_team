"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { useNovelReaderSettings, useReadingProgress } from "@/store/reader-settings";
import { useRewards, chapterKey } from "@/store/rewards";
import type { Chapter } from "@/lib/types";
import { cn } from "@/lib/utils";

const THEME_CLASSES: Record<string, string> = {
  sepia: "bg-[#f4ecd8] text-[#3b2f22]",
  light: "bg-white text-[#1a1a1a]",
  dark: "bg-[#15151a] text-[#e4e1d8]",
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
  const containerRef = useRef<HTMLDivElement>(null);

  const paragraphs = (chapter.content ?? "").split(/\n{2,}/).filter(Boolean);

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

  // A chapter only counts toward the daily reading reward once actually finished (scrolled to the end).
  const recordChapterRead = useRewards((s) => s.recordChapterRead);
  const recordedRef = useRef(false);
  useEffect(() => {
    recordedRef.current = false;
  }, [chapter.id]);
  useEffect(() => {
    if (recordedRef.current) return;
    if (scrollProgress >= 0.98) {
      recordedRef.current = true;
      recordChapterRead(chapterKey(seriesId, chapter.number));
    }
  }, [scrollProgress, seriesId, chapter.number, recordChapterRead]);

  return (
    <div className={cn("min-h-screen transition-colors duration-300", THEME_CLASSES[theme])}>
      <div className="fixed inset-x-0 top-0 z-30 h-1 bg-black/10">
        <div
          className="h-full bg-lunex-gradient transition-all duration-200"
          style={{ width: `${scrollProgress * 100}%` }}
        />
      </div>

      <div ref={containerRef} dir="rtl" className="mx-auto max-w-[70ch] px-6 py-12">
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
