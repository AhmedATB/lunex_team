"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useReaderSettings, useReadingProgress } from "@/store/reader-settings";
import { useReaderChrome } from "@/store/reader-chrome";
import { useRewards, chapterKey } from "@/store/rewards";
import { ProtectedImage } from "@/components/reader/protected-image";
import { ProtectedPage } from "@/components/reader/protected-page";
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
  const toggleToolbar = useReaderChrome((s) => s.toggleToolbar);
  const router = useRouter();
  const [pageIndex, setPageIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // A chapter uploaded through the real pipeline (admin/chapters) has a
  // matching real backend Chapter for this series+number; older/demo
  // chapters don't, and keep using the mock picsum placeholder flow below.
  // Checked fresh per chapter since some series mix real and mock chapters
  // during this migration.
  const [realChapterId, setRealChapterId] = useState<string | null>(null);
  const [realPageCount, setRealPageCount] = useState(0);
  const [checkedReal, setCheckedReal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCheckedReal(false);
    setRealChapterId(null);
    setRealPageCount(0);

    fetch(`/api/chapters?seriesId=${encodeURIComponent(seriesId)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((list: { id: string; number: number }[]) => {
        if (cancelled) return null;
        const match = Array.isArray(list) ? list.find((c) => c.number === chapter.number) : undefined;
        if (!match) return null;
        return fetch(`/api/chapters/${match.id}`).then((res) => (res.ok ? res.json() : null));
      })
      .then((full: { id: string; pages: { pageNumber: number }[] } | null) => {
        if (cancelled) return;
        if (full?.pages?.length) {
          setRealChapterId(full.id);
          setRealPageCount(full.pages.length);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCheckedReal(true);
      });

    return () => {
      cancelled = true;
    };
  }, [seriesId, chapter.number]);

  const isReal = Boolean(realChapterId) && realPageCount > 0;
  const pageCount = isReal ? realPageCount : chapter.pages;

  const pages = useMemo(
    () =>
      Array.from({ length: isReal ? 0 : chapter.pages }).map(
        (_, i) => `https://picsum.photos/seed/lunex-page-${chapter.id}-${i}/900/1350`
      ),
    [chapter, isReal]
  );

  useEffect(() => {
    setProgress(seriesId, chapter.number);
  }, [seriesId, chapter.number, setProgress]);

  const goNext = useCallback(() => {
    if (mode !== "vertical") {
      if (pageIndex < pageCount - 1) return setPageIndex((i) => i + 1);
    }
    if (nextChapter) router.push(`/series/${seriesSlug}/${nextChapter}`);
  }, [mode, pageIndex, pageCount, nextChapter, router, seriesSlug]);

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

  // The vertical container grows with its content — the WINDOW scrolls, not the
  // container — so progress must be measured against the container's viewport
  // position, not its own scrollTop (which stays 0 forever).
  const [scrollProgress, setScrollProgress] = useState(0);
  useEffect(() => {
    if (mode !== "vertical") return;
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
  }, [mode]);

  const progress = mode === "vertical" ? scrollProgress : pageCount ? (pageIndex + 1) / pageCount : 0;

  // A chapter only counts toward the daily reading reward once actually FINISHED
  // (scrolled to the end / reached the last page) — merely opening it is not enough.
  const recordChapterRead = useRewards((s) => s.recordChapterRead);
  const recordedRef = useRef(false);
  useEffect(() => {
    recordedRef.current = false;
  }, [chapter.id]);
  useEffect(() => {
    if (recordedRef.current) return;
    const finished =
      mode === "vertical" ? scrollProgress >= 0.98 : pageCount > 0 && pageIndex >= pageCount - 1;
    if (finished) {
      recordedRef.current = true;
      recordChapterRead(chapterKey(seriesId, chapter.number));
    }
  }, [mode, scrollProgress, pageIndex, pageCount, seriesId, chapter.number, recordChapterRead]);

  const fitClass =
    fit === "width" ? "w-full h-auto" : fit === "height" ? "h-[calc(100vh-8rem)] w-auto" : "";

  const filterStyle = { filter: `brightness(${brightness}%) contrast(${contrast}%)` };
  const zoomStyle = { transform: `scale(${zoom / 100})`, transformOrigin: "top center" };

  return (
    <div className="relative flex flex-col">
      <div className="fixed inset-x-0 top-0 z-30 h-1 bg-white/5">
        <div
          className="h-full bg-lunex-gradient transition-all duration-200"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {!checkedReal ? (
        <div className="mx-auto w-full max-w-3xl animate-pulse rounded-lg bg-white/5 py-4" style={{ minHeight: 480 }} />
      ) : mode === "vertical" ? (
        <div
          ref={containerRef}
          className="reader-protect mx-auto flex max-w-3xl flex-col items-center gap-1 overflow-y-auto py-4"
          onContextMenu={(e) => e.preventDefault()}
          onClick={toggleToolbar}
        >
          {Array.from({ length: pageCount }).map((_, i) => (
            <div key={i} style={zoomStyle} className="w-full">
              {isReal ? (
                <ProtectedPage
                  chapterId={realChapterId!}
                  pageNumber={i + 1}
                  alt={`صفحة ${i + 1}`}
                  priority={i < 2}
                  className={fitClass}
                />
              ) : (
                <ProtectedImage
                  src={pages[i]}
                  alt={`صفحة ${i + 1}`}
                  priority={i < 2}
                  style={filterStyle}
                  className={fitClass}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div
          className="reader-protect relative mx-auto flex max-w-3xl items-center justify-center py-4"
          onContextMenu={(e) => e.preventDefault()}
          onClick={toggleToolbar}
        >
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            aria-label="السابق"
            className="absolute start-0 z-10 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
          >
            <ChevronRight className="h-6 w-6 rtl:rotate-180" />
          </button>
          <div style={zoomStyle} className="w-full">
            {isReal ? (
              <ProtectedPage
                chapterId={realChapterId!}
                pageNumber={pageIndex + 1}
                alt={`صفحة ${pageIndex + 1}`}
                priority
                className={fitClass}
              />
            ) : (
              <ProtectedImage
                src={pages[pageIndex]}
                alt={`صفحة ${pageIndex + 1}`}
                priority
                style={filterStyle}
                className={fitClass}
              />
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            aria-label="التالي"
            className="absolute end-0 z-10 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
          >
            <ChevronLeft className="h-6 w-6 rtl:rotate-180" />
          </button>
          <p className="absolute bottom-2 start-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
            {pageIndex + 1} / {pageCount}
          </p>
        </div>
      )}
    </div>
  );
}
