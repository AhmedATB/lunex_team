"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { useReaderSettings, useReadingProgress } from "@/store/reader-settings";
import { useReaderChrome } from "@/store/reader-chrome";
import { useProgress } from "@/store/progress";
import { fetchPosition, savePosition } from "@/lib/reading-position";
import { ProtectedImage } from "@/components/reader/protected-image";
import { ProtectedPage } from "@/components/reader/protected-page";
import { Button } from "@/components/ui/button";
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
  const pathname = usePathname();
  const [pageIndex, setPageIndex] = useState(0);
  // Page images are issued only to signed-in readers (they carry the reader's id for leak tracing), so a visitor without an account gets a prompt, not a blank page.
  const [loginRequired, setLoginRequired] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  /** Always the current chapter's real id, read from inside listeners whose own effect does not depend on it. */
  const realChapterIdRef = useRef<string | null>(null);
  /** The position last measured, so leaving mid-chapter can flush it even between the periodic sends. */
  const currentFractionRef = useRef(0);
  const lastSentRef = useRef<{ at: number; fraction: number }>({ at: 0, fraction: -1 });
  /** Set once this chapter's saved position has been applied (or found not to exist) — so a later effect run never fights the reader's own scrolling. */
  const restoredRef = useRef(false);

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
    setLoginRequired(false);
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

  // One view per reader per chapter per day is counted on the server; asking again is harmless.
  useEffect(() => {
    if (!realChapterId) return;
    fetch(`/api/catalog/chapters/${encodeURIComponent(realChapterId)}/view`, { method: "POST", keepalive: true }).catch(() => {});
  }, [realChapterId]);

  useEffect(() => {
    realChapterIdRef.current = realChapterId;
  }, [realChapterId]);

  const isReal = Boolean(realChapterId) && realPageCount > 0;
  const pageCount = isReal ? realPageCount : chapter.pages;

  /** Sends the current position, at most every few seconds unless `force` (leaving the chapter, or the tab is being hidden). */
  const sendPosition = useCallback((fraction: number, force = false) => {
    const id = realChapterIdRef.current;
    if (!id) return;
    const now = Date.now();
    const last = lastSentRef.current;
    if (!force && now - last.at < 2_500 && Math.abs(fraction - last.fraction) < 0.02) return;
    lastSentRef.current = { at: now, fraction };
    savePosition(id, fraction);
  }, []);

  // Leaving this chapter for another (the reader route reuses the same component instance) flushes its last position first.
  useEffect(() => {
    restoredRef.current = false;
    return () => sendPosition(currentFractionRef.current, true);
  }, [chapter.id, sendPosition]);

  // Closing the tab, or switching away from it, flushes the position the same way.
  useEffect(() => {
    const flush = () => sendPosition(currentFractionRef.current, true);
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", flush);
    };
  }, [sendPosition]);

  // Resume where the reader left off — skipped for a chapter already finished (nothing to resume there) and for one
  // barely started or already at its end (opening at the top, as usual, reads better than a barely-there restore).
  useEffect(() => {
    if (!realChapterId || !checkedReal || restoredRef.current) return;
    let cancelled = false;
    fetchPosition(realChapterId).then((saved) => {
      if (cancelled || restoredRef.current) return;
      restoredRef.current = true;
      if (!saved || saved.finished || saved.fraction < 0.02 || saved.fraction > 0.95) return;
      if (mode !== "vertical") {
        if (pageCount > 1) setPageIndex(Math.round(saved.fraction * (pageCount - 1)));
        return;
      }
      // A moment for the pages around the target to lay out (each starts at a placeholder height and settles once its real aspect ratio loads).
      setTimeout(() => {
        if (cancelled) return;
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        if (total > 0) window.scrollTo({ top: rect.top + window.scrollY + saved.fraction * total });
      }, 700);
    });
    return () => {
      cancelled = true;
    };
  }, [realChapterId, checkedReal, mode, pageCount]);

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
      const value = total <= 0 ? 1 : Math.min(1, Math.max(0, -rect.top / total));
      setScrollProgress(value);
      currentFractionRef.current = value;
      sendPosition(value);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mode, sendPosition]);

  // A page turned in the paged/horizontal modes is this chapter's new position, the same as a scroll in the vertical one.
  useEffect(() => {
    if (mode === "vertical" || pageCount <= 0) return;
    const value = pageCount > 1 ? pageIndex / (pageCount - 1) : 1;
    currentFractionRef.current = value;
    sendPosition(value);
  }, [mode, pageIndex, pageCount, sendPosition]);

  const progress = mode === "vertical" ? scrollProgress : pageCount ? (pageIndex + 1) / pageCount : 0;

  // A chapter only counts once actually FINISHED (scrolled to the end / reached the last page) — merely opening it is not enough.
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
      // Experience and reading credits are the server's to give: it checks the chapter was opened, for long enough, and is beyond what was finished.
      if (realChapterId) void useProgress.getState().complete(realChapterId);
    }
  }, [mode, scrollProgress, pageIndex, pageCount, realChapterId]);

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
      ) : loginRequired ? (
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
          <Lock className="h-12 w-12 text-primary-300" />
          <h2 className="font-display text-xl font-bold text-white">سجّل الدخول لقراءة هذا الفصل</h2>
          <p className="text-sm leading-relaxed text-lunex-gray">
            صفحات الفصول متاحة للأعضاء المسجّلين فقط. الحساب مجاني ويحفظ تقدّمك في القراءة ومفضّلتك.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href={`/login?next=${encodeURIComponent(pathname)}`}>تسجيل الدخول</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/register">إنشاء حساب</Link>
            </Button>
          </div>
        </div>
      ) : mode === "vertical" ? (
        <div
          ref={containerRef}
          className="reader-protect mx-auto flex max-w-3xl flex-col items-center overflow-y-auto py-4"
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
                  onLoginRequired={() => setLoginRequired(true)}
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
                onLoginRequired={() => setLoginRequired(true)}
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
