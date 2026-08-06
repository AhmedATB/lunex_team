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
 * "الشبكة" (Grid Wall) — no hero slider: opens straight onto a dense ranked
 * grid, like a wall of screens. Denser, faster-scanning, less cinematic —
 * matches the neon-cyber mood better than a slow rotating spotlight would.
 */
export function NeonCyberHome(data: HomeLayoutData) {
  return (
    <div className="container relative space-y-12 py-6">
      <FadeIn>
        <StatsBar stats={data.stats} />
      </FadeIn>

      <FadeIn>
        <TrendingRankGrid series={data.trending} title="الأكثر رواجاً الآن" />
      </FadeIn>

      <FadeIn>
        <ContinueReading />
      </FadeIn>

      <FadeIn>
        <LatestChaptersGrid chapters={data.latestChapters} />
      </FadeIn>

      <FadeIn>
        <section className="space-y-4">
          <h2 className="section-title font-display text-xl font-bold text-white sm:text-2xl">تصفح حسب التصنيف</h2>
          <GenreGrid genres={data.genres} />
        </section>
      </FadeIn>

      <FadeIn>
        <SeriesRow title="الأكثر شعبية اليوم" href="/search?sort=views" series={data.popular} />
      </FadeIn>

      <FadeIn>
        <SeriesRow title="تحديثات حديثة" href="/search?sort=latest" series={data.recentlyUpdated} />
      </FadeIn>

      <FadeIn>
        <div className="grid gap-4 sm:grid-cols-2">
          <SeriesRow title="مستمرة" href="/search?status=ongoing" series={data.ongoing.slice(0, 6)} />
          <SeriesRow title="ننصح لك بها" href="/search" series={data.recommended} />
        </div>
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
