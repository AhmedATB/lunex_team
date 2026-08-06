import { StatsBar } from "@/components/home/stats-bar";
import { GenreGrid } from "@/components/home/genre-grid";
import { NewsSection } from "@/components/home/news-section";
import { TopReaders } from "@/components/home/top-readers";
import { LatestComments } from "@/components/home/latest-comments";
import { ContinueReading } from "@/components/home/continue-reading";
import { LatestChaptersGrid } from "@/components/home/latest-chapters-grid";
import { TrendingRankGrid } from "@/components/home/trending-rank-grid";
import { SeriesRow } from "@/components/shared/series-card";
import { FadeIn } from "@/components/motion/fade-in";
import type { HomeLayoutData } from "./types";

/**
 * "ساحة المعركة" (Battle Wall) — opens directly on the ranked leaderboard,
 * no hero, no warm-up: aggressive and competitive, matching the crimson
 * mood. Popular-today and trending both get the dense ranked treatment
 * back to back before anything calmer appears.
 */
export function CrimsonBloodHome(data: HomeLayoutData) {
  return (
    <div className="container relative space-y-12 py-6">
      <FadeIn>
        <TrendingRankGrid series={data.trending} title="الأقوى الآن" />
      </FadeIn>

      <FadeIn delay={0.05}>
        <StatsBar stats={data.stats} />
      </FadeIn>

      <FadeIn>
        <TrendingRankGrid series={data.popular} title="الأكثر شعبية اليوم" href="/search?sort=views" />
      </FadeIn>

      <FadeIn>
        <ContinueReading />
      </FadeIn>

      <FadeIn>
        <LatestChaptersGrid chapters={data.latestChapters} />
      </FadeIn>

      <FadeIn>
        <SeriesRow title="تحديثات حديثة" href="/search?sort=latest" series={data.recentlyUpdated} />
      </FadeIn>

      <FadeIn>
        <SeriesRow title="إصدارات جديدة" href="/search?sort=latest" series={data.newReleases} />
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
