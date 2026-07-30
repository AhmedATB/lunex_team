import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSeriesBySlug, getChaptersBySeries, getCommentsForSeries } from "@/lib/mock/repo";
import { getMockDatabase } from "@/lib/mock/generate";
import { ReaderToolbar } from "@/components/reader/reader-toolbar";
import { ReaderViewer } from "@/components/reader/reader-viewer";
import { ChapterGate } from "@/components/reader/chapter-gate";
import { CommentSection } from "@/components/series/comment-section";
import { safeDecodeURIComponent } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; chapter: string }>;
}): Promise<Metadata> {
  const { slug, chapter } = await params;
  const series = await getSeriesBySlug(safeDecodeURIComponent(slug));
  if (!series) return { title: "غير موجود" };
  return { title: `${series.titleAr} - الفصل ${chapter}` };
}

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ slug: string; chapter: string }>;
}) {
  const { slug, chapter: chapterParam } = await params;
  const series = await getSeriesBySlug(safeDecodeURIComponent(slug));
  if (!series) notFound();

  const chapters = await getChaptersBySeries(series.id);
  const chapterNumber = Number(chapterParam);
  const chapter = chapters.find((c) => c.number === chapterNumber);
  if (!chapter) notFound();

  const sorted = [...chapters].sort((a, b) => a.number - b.number);
  const idx = sorted.findIndex((c) => c.number === chapter.number);
  const prevChapter = idx > 0 ? sorted[idx - 1].number : undefined;
  const nextChapter = idx < sorted.length - 1 ? sorted[idx + 1].number : undefined;

  const comments = await getCommentsForSeries(series.id);
  const db = getMockDatabase();

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
