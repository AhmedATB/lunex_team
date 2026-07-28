"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useReaderSettings, useReadingProgress } from "@/store/reader-settings";
import type { Chapter } from "@/lib/types";

export function ReaderViewer({
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
  const { mode, fit, zoom, brightness, contrast } = useReaderSettings();
  const setProgress = useReadingProgress((s) => s.setProgress);
  const router = useRouter();
  const [pageIndex, setPageIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const pages = useMemo(
    () =>
      Array.from({ length: chapter.pages }).map(
        (_, i) => `https://picsum.photos/seed/lunex-page-${chapter.id}-${i}/900/1350`
      ),
    [chapter]
  );

  useEffect(() => {
    setProgress(seriesId, chapter.number);
  }, [seriesId, chapter.number, setProgress]);

  const goNext = useCallback(() => {
    if (mode !== "vertical") {
      if (pageIndex < pages.length - 1) return setPageIndex((i) => i + 1);
    }
    if (nextChapter) router.push(`/series/${seriesSlug}/${nextChapter}`);
  }, [mode, pageIndex, pages.length, nextChapter, router, seriesSlug]);

  const goPrev = useCallback(() => {
    if (mode !== "vertical") {
      if (pageIndex > 0) return setPageIndex((i) => i - 1);
    }
    if (prevChapter) router.push(`/series/${seriesSlug}/${prevChapter}`);
  }, [mode, pageIndex, prevChapter, router, seriesSlug]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") (document.dir === "rtl" ? goPrev : goNext)();
      if (e.key === "ArrowLeft") (document.dir === "rtl" ? goNext : goPrev)();
      if (e.key === " ") {
        e.preventDefault();
        goNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  const [scrollProgress, setScrollProgress] = useState(0);
  useEffect(() => {
    if (mode !== "vertical") return;
    function onScroll() {
      const el = containerRef.current;
      if (!el) return;
      const scrollable = el.scrollHeight - el.clientHeight;
      setScrollProgress(scrollable > 0 ? Math.min(1, el.scrollTop / scrollable) : 0);
    }
    const el = containerRef.current;
    el?.addEventListener("scroll", onScroll);
    return () => el?.removeEventListener("scroll", onScroll);
  }, [mode]);

  const progress = mode === "vertical" ? scrollProgress : pages.length ? (pageIndex + 1) / pages.length : 0;

  const fitClass =
    fit === "width" ? "w-full h-auto" : fit === "height" ? "h-[calc(100vh-8rem)] w-auto" : "";

  const filterStyle = { filter: `brightness(${brightness}%) contrast(${contrast}%)` };
  const zoomStyle = { transform: `scale(${zoom / 100})`, transformOrigin: "top center" };

  return (
    <div className="relative flex flex-col">
      <div className="fixed inset-x-0 top-16 z-30 h-1 bg-white/5">
        <div
          className="h-full bg-lunex-gradient transition-all duration-200"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {mode === "vertical" ? (
        <div ref={containerRef} className="mx-auto flex max-w-3xl flex-col items-center gap-1 overflow-y-auto py-4">
          {pages.map((src, i) => (
            <div key={src} style={zoomStyle} className="w-full">
              <Image
                src={src}
                alt={`صفحة ${i + 1}`}
                width={900}
                height={1350}
                sizes="(max-width: 768px) 100vw, 768px"
                priority={i < 2}
                loading={i < 2 ? "eager" : "lazy"}
                style={filterStyle}
                className={fitClass}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="relative mx-auto flex max-w-3xl items-center justify-center py-4">
          <button
            onClick={goPrev}
            aria-label="السابق"
            className="absolute start-0 z-10 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
          >
            <ChevronRight className="h-6 w-6 rtl:rotate-180" />
          </button>
          <div style={zoomStyle}>
            <Image
              src={pages[pageIndex]}
              alt={`صفحة ${pageIndex + 1}`}
              width={900}
              height={1350}
              priority
              style={filterStyle}
              className={fitClass}
            />
          </div>
          <button
            onClick={goNext}
            aria-label="التالي"
            className="absolute end-0 z-10 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
          >
            <ChevronLeft className="h-6 w-6 rtl:rotate-180" />
          </button>
          <p className="absolute bottom-2 start-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
            {pageIndex + 1} / {pages.length}
          </p>
        </div>
      )}
    </div>
  );
}
