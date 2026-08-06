import { StatsBar } from "@/components/home/stats-bar";
import { GenreGrid } from "@/components/home/genre-grid";
import { NewsSection } from "@/components/home/news-section";
import { TopReaders } from "@/components/home/top-readers";
import { LatestComments } from "@/components/home/latest-comments";
import { ContinueReading } from "@/components/home/continue-reading";
import { LatestChaptersList } from "@/components/home/latest-chapters-list";
import { SeriesRow } from "@/components/shared/series-card";
import { FadeIn } from "@/components/motion/fade-in";
import type { HomeLayoutData } from "./types";

/**
 * "الفهرس" (Editorial Index) — text-forward and list-based rather than a
 * wall of cover art: no big hero, chapters read like a table of contents.
 * Matches the sepia/paper mood of a reading-focused, less flashy page.
 */
export function InkPaperHome(data: HomeLayoutData) {
  return (
    <div className="container relative space-y-12 py-6">
      <FadeIn>
        <ContinueReading />
      </FadeIn>

      <FadeIn delay={0.05}>
        <StatsBar stats={data.stats} />
      </FadeIn>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <FadeIn>
          <LatestChaptersList chapters={data.latestChapters} />
        </FadeIn>
        <FadeIn>
          <NewsSection news={data.news} />
        </FadeIn>
      </div>

      <FadeIn>
        <SeriesRow title="الأكثر شعبية اليوم" href="/search?sort=views" series={data.popular} />
      </FadeIn>

      <FadeIn>
        <SeriesRow title="تحديثات حديثة" href="/search?sort=latest" series={data.recentlyUpdated} />
      </FadeIn>

      <FadeIn>
        <div className="grid gap-4 sm:grid-cols-2">
          <SeriesRow title="مستمرة" href="/search?status=ongoing" series={data.ongoing.slice(0, 6)} />
          <SeriesRow title="مكتملة" href="/search?status=completed" series={data.completed} />
        </div>
      </FadeIn>

      <FadeIn>
        <SeriesRow title="ننصح لك بها" href="/search" series={data.recommended} />
      </FadeIn>

      <div className="magic-divider" />

      <FadeIn>
        <section className="space-y-4">
          <h2 className="section-title font-display text-xl font-bold text-white sm:text-2xl">تصفح حسب التصنيف</h2>
          <GenreGrid genres={data.genres} />
        </section>
      </FadeIn>

      <div className="grid gap-8 lg:grid-cols-2">
        <FadeIn>
          <TopReaders users={data.topReaders} />
        </FadeIn>
        <FadeIn>
          <LatestComments comments={data.latestComments} users={data.users} seriesMap={data.seriesMap} />
        </FadeIn>
      </div>
    </div>
  );
}
