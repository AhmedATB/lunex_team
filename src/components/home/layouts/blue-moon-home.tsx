import { HeroSlider } from "@/components/home/hero-slider";
import { StatsBar } from "@/components/home/stats-bar";
import { GenreGrid } from "@/components/home/genre-grid";
import { NewsSection } from "@/components/home/news-section";
import { TopReaders } from "@/components/home/top-readers";
import { LatestComments } from "@/components/home/latest-comments";
import { ContinueReading } from "@/components/home/continue-reading";
import { MoonCard } from "@/components/shared/series-cards/moon-card";
import { SeriesShowcase } from "@/components/shared/series-showcase";
import { FadeIn } from "@/components/motion/fade-in";
import type { HomeLayoutData } from "./types";

/**
 * "الهادئ" (Calm) — every series display uses MoonCard: a soft gallery
 * card with no heavy gradient burned onto the image and info sitting
 * calmly below, plus deliberately spacious gaps between sections.
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
        <SeriesShowcase
          title="ننصح لك بها"
          href="/search"
          series={data.recommended}
          renderCard={(s) => <MoonCard key={s.id} series={s} />}
        />
      </FadeIn>

      <FadeIn>
        <section className="space-y-4">
          <h2 className="section-title font-display text-xl font-bold text-white sm:text-2xl">تصفح حسب التصنيف</h2>
          <GenreGrid genres={data.genres} />
        </section>
      </FadeIn>

      <FadeIn>
        <SeriesShowcase
          title="تحديثات حديثة"
          href="/search?sort=latest"
          series={data.recentlyUpdated}
          renderCard={(s) => <MoonCard key={s.id} series={s} />}
        />
      </FadeIn>

      <FadeIn>
        <SeriesShowcase
          title="مكتملة"
          href="/search?status=completed"
          series={data.completed}
          renderCard={(s) => <MoonCard key={s.id} series={s} />}
        />
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
