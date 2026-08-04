"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { getMockDatabase } from "@/lib/mock/generate";
import { useTeamManagement } from "@/store/team-management";
import { ReaderToolbar } from "@/components/reader/reader-toolbar";
import { ReaderViewer } from "@/components/reader/reader-viewer";
import { ChapterGate } from "@/components/reader/chapter-gate";
import { CommentSection } from "@/components/series/comment-section";
import { safeDecodeURIComponent } from "@/lib/utils";

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
  const removedIds = new Set(store.removedChapterIds);
  const allChapters = series
    ? [...db.chapters, ...store.addedChapters]
        .filter((c) => c.seriesId === series.id && !removedIds.has(c.id))
        .map((c) => ({ ...c, ...store.chapterOverrides[c.id] }))
    : [];
  const chapterNumber = Number(chapterParam);
  const chapter = allChapters.find((c) => c.number === chapterNumber);

  useEffect(() => {
    document.title = series ? `${series.titleAr} - الفصل ${chapterParam} | LUNEX TEAM` : "غير موجود | LUNEX TEAM";
  }, [series, chapterParam]);

  if (!ready) return null;
  if (!series || !chapter) {
    notFound();
  }

  const sorted = [...allChapters].sort((a, b) => a.number - b.number);
  const idx = sorted.findIndex((c) => c.number === chapter.number);
  const prevChapter = idx > 0 ? sorted[idx - 1].number : undefined;
  const nextChapter = idx < sorted.length - 1 ? sorted[idx + 1].number : undefined;

  const comments = db.comments.filter((c) => c.seriesId === series.id);

  return (
    <div className="min-h-screen bg-black">
      <ReaderToolbar
        seriesSlug={series.slug}
        seriesTitle={series.titleAr}
        chapter={chapter}
        chapters={sorted}
        prevChapter={prevChapter}
        nextChapter={nextChapter}
      />
      <ChapterGate
        seriesId={series.id}
        seriesSlug={series.slug}
        seriesTitle={series.titleAr}
        chapterId={chapter.id}
        chapterNumber={chapter.number}
        latestChapterNumber={sorted[sorted.length - 1]?.number ?? chapter.number}
      >
        <ReaderViewer
          seriesSlug={series.slug}
          seriesId={series.id}
          chapter={chapter}
          prevChapter={prevChapter}
          nextChapter={nextChapter}
        />
      </ChapterGate>
      <div className="container max-w-3xl space-y-4 py-8">
        <h2 className="font-display text-lg font-bold text-white">التعليقات على الفصل</h2>
        <CommentSection seriesId={series.id} initialComments={comments} users={db.users} />
      </div>
    </div>
  );
}
