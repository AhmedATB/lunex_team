import { HeroSlider } from "@/components/home/hero-slider";
import { StatsBar } from "@/components/home/stats-bar";
import { GenreGrid } from "@/components/home/genre-grid";
import { NewsSection } from "@/components/home/news-section";
import { TopReaders } from "@/components/home/top-readers";
import { LatestComments } from "@/components/home/latest-comments";
import { ContinueReading } from "@/components/home/continue-reading";
import { SeriesRow } from "@/components/shared/series-card";
import { FadeIn } from "@/components/motion/fade-in";
import type { HomeLayoutData } from "./types";

/**
 * "الهادئ" (Calm) — deliberately spacious: wider gaps between sections,
 * one curated row at a time rather than a wall of dense grids, genre
 * browsing offered early as a quiet way to explore rather than being
 * buried under a dozen ranked lists. Matches the calm, quiet mood blue-moon
 * is meant to evoke.
 */
export function BlueMoonHome(data: HomeLayoutData) {
  return (
    <div className="container relative space-y-20 py-8">
      <FadeIn>
        <HeroSlider series={data.featured.length ? data.featured : data.trending.slice(0, 5)} />
      </FadeIn>

      <FadeIn>
        <ContinueReading />
      </FadeIn>

      <FadeIn delay={0.05}>
        <StatsBar stats={data.stats} />
      </FadeIn>

      <FadeIn>
        <SeriesRow title="ننصح لك بها" href="/search" series={data.recommended} />
      </FadeIn>

      <FadeIn>
        <section className="space-y-4">
          <h2 className="section-title font-display text-xl font-bold text-white sm:text-2xl">تصفح حسب التصنيف</h2>
          <GenreGrid genres={data.genres} />
        </section>
      </FadeIn>

      <FadeIn>
        <SeriesRow title="تحديثات حديثة" href="/search?sort=latest" series={data.recentlyUpdated} />
      </FadeIn>

      <FadeIn>
        <SeriesRow title="مكتملة" href="/search?status=completed" series={data.completed} />
      </FadeIn>

      <div className="magic-divider" />

      <FadeIn>
        <NewsSection news={data.news} />
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
