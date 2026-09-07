"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { getMockDatabase } from "@/lib/mock/generate";
import { useTeamManagement } from "@/store/team-management";
import { ReaderToolbar } from "@/components/reader/reader-toolbar";
import { ReaderViewer } from "@/components/reader/reader-viewer";
import { NovelToolbar } from "@/components/reader/novel-toolbar";
import { NovelViewer } from "@/components/reader/novel-viewer";
import { ChapterGate } from "@/components/reader/chapter-gate";
import { CommentSection } from "@/components/series/comment-section";
import { safeDecodeURIComponent, cn } from "@/lib/utils";
import type { Chapter } from "@/lib/types";

interface RealChapterRow {
  id: string;
  seriesId: string;
  teamId: string;
  number: number;
  title: string;
  isPublished: boolean;
  scheduledFor: string | null;
  createdAt: string;
}

export default function ReaderPage() {
  const params = useParams<{ slug: string; chapter: string }>();
  const slug = safeDecodeURIComponent(params.slug);
  const chapterParam = params.chapter;

  const db = useMemo(() => getMockDatabase(), []);
  const store = useTeamManagement();

  // Persisted stores rehydrate after mount (see StoreHydration), so a chapter added
  // via the admin/dashboard is still missing on the very first render after a hard
  // reload. Wait one tick before trusting a "not found" result.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const series = [...db.series, ...store.addedSeries].find((s) => s.slug === slug);

  // Chapters uploaded through the real pipeline (admin/chapters) live in
  // Postgres, not the mock database — fetch and merge them so this route
  // recognizes them too, instead of 404ing before ReaderViewer ever gets a
  // chance to check for a real chapter itself.
  const [realChapters, setRealChapters] = useState<RealChapterRow[]>([]);
  const [realChecked, setRealChecked] = useState(false);
  useEffect(() => {
    if (!series) {
      setRealChecked(true);
      return;
    }
    let cancelled = false;
    setRealChecked(false);
    fetch(`/api/chapters?seriesId=${encodeURIComponent(series.id)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((list: RealChapterRow[]) => {
        if (!cancelled) setRealChapters(Array.isArray(list) ? list : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRealChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [series?.id]);

  const removedIds = new Set(store.removedChapterIds);
  const mappedReal: Chapter[] = series
    ? realChapters.map((c) => ({
        id: c.id,
        seriesId: c.seriesId,
        number: c.number,
        title: c.title,
        pages: 0,
        releasedAt: c.createdAt,
        views: 0,
        isPublished: c.isPublished,
        scheduledFor: c.scheduledFor ?? undefined,
        teamId: c.teamId,
      }))
    : [];
  const allChapters = series
    ? [...db.chapters, ...store.addedChapters, ...mappedReal]
        .filter((c) => c.seriesId === series.id && !removedIds.has(c.id))
        .map((c) => ({ ...c, ...store.chapterOverrides[c.id] }))
    : [];
  const chapterNumber = Number(chapterParam);
  const chapter = allChapters.find((c) => c.number === chapterNumber);

  useEffect(() => {
    document.title = series ? `${series.titleAr} - الفصل ${chapterParam} | LUNEX TEAM` : "غير موجود | LUNEX TEAM";
  }, [series, chapterParam]);

  // Navigating to a new chapter reuses this same route component (no remount),
  // so the browser keeps whatever scroll position the previous chapter ended
  // at — finishing chapter N at the bottom and pressing "next" would otherwise
  // drop you at the bottom of chapter N+1 instead of its start.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [chapter?.id]);

  if (!ready || !realChecked) return null;
  if (process.env.NODE_ENV !== "production" || true) {
    console.log(
      "[reader-debug]",
      JSON.stringify({
        seriesId: series?.id,
        chapterNumber,
        chapterFound: Boolean(chapter),
        allChapterNumbers: allChapters.map((c) => c.number),
        realChaptersRaw: realChapters,
      })
    );
  }
  if (!series || !chapter) {
    notFound();
  }

  const sorted = [...allChapters].sort((a, b) => a.number - b.number);
  const idx = sorted.findIndex((c) => c.number === chapter.number);
  const prevChapter = idx > 0 ? sorted[idx - 1].number : undefined;
  const nextChapter = idx < sorted.length - 1 ? sorted[idx + 1].number : undefined;

  const comments = db.comments.filter((c) => c.seriesId === series.id);
  const isNovel = series.type === "novel";

  return (
    <div className={cn("min-h-screen", isNovel ? "bg-background" : "bg-black")}>
      {isNovel ? (
        <NovelToolbar
          seriesSlug={series.slug}
          seriesTitle={series.titleAr}
          chapter={chapter}
          chapters={sorted}
          prevChapter={prevChapter}
          nextChapter={nextChapter}
        />
      ) : (
        <ReaderToolbar
          seriesSlug={series.slug}
          seriesTitle={series.titleAr}
          chapter={chapter}
          chapters={sorted}
          prevChapter={prevChapter}
          nextChapter={nextChapter}
        />
      )}
      <ChapterGate
        seriesId={series.id}
        seriesSlug={series.slug}
        seriesTitle={series.titleAr}
        chapterId={chapter.id}
        chapterNumber={chapter.number}
        latestChapterNumber={sorted[sorted.length - 1]?.number ?? chapter.number}
      >
        {isNovel ? (
          <NovelViewer
            seriesSlug={series.slug}
            seriesId={series.id}
            chapter={chapter}
            prevChapter={prevChapter}
            nextChapter={nextChapter}
          />
        ) : (
          <ReaderViewer
            seriesSlug={series.slug}
            seriesId={series.id}
            chapter={chapter}
            prevChapter={prevChapter}
            nextChapter={nextChapter}
          />
        )}
      </ChapterGate>
      <div className="container max-w-3xl space-y-4 py-8">
        <h2 className={cn("font-display text-lg font-bold", isNovel ? "text-foreground" : "text-white")}>
          التعليقات على الفصل
        </h2>
        <CommentSection seriesId={series.id} teamId={series.teamId} initialComments={comments} users={db.users} />
      </div>
    </div>
  );
}
