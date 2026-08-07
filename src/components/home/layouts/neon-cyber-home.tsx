import { StatsBar } from "@/components/home/stats-bar";
import { GenreGrid } from "@/components/home/genre-grid";
import { NewsSection } from "@/components/home/news-section";
import { TopReaders } from "@/components/home/top-readers";
import { LatestComments } from "@/components/home/latest-comments";
import { ContinueReading } from "@/components/home/continue-reading";
import { LatestChaptersGrid } from "@/components/home/latest-chapters-grid";
import { CyberCard } from "@/components/shared/series-cards/cyber-card";
import { SeriesShowcase } from "@/components/shared/series-showcase";
import { FadeIn } from "@/components/motion/fade-in";
import type { HomeLayoutData } from "./types";

/**
 * "الشبكة" (Grid Wall) — no hero slider: opens straight onto a dense ranked
 * grid, like a wall of screens. Every series display in this layout uses
 * CyberCard (sharp corners, HUD brackets, info burned onto the image), not
 * just the trending section — the card design itself is the differentiator
 * here, not just section order.
 */
export function NeonCyberHome(data: HomeLayoutData) {
  return (
    <div className="container relative space-y-12 py-6">
      <FadeIn>
        <StatsBar stats={data.stats} />
      </FadeIn>

      <FadeIn>
        <SeriesShowcase
          title="الأكثر رواجاً الآن"
          series={data.trending}
          renderCard={(s, i) => <CyberCard key={s.id} series={s} rank={i + 1} />}
        />
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
        <SeriesShowcase
          title="الأكثر شعبية اليوم"
          href="/search?sort=views"
          series={data.popular}
          renderCard={(s) => <CyberCard key={s.id} series={s} />}
        />
      </FadeIn>

      <FadeIn>
        <SeriesShowcase
          title="تحديثات حديثة"
          href="/search?sort=latest"
          series={data.recentlyUpdated}
          renderCard={(s) => <CyberCard key={s.id} series={s} />}
        />
      </FadeIn>

      <FadeIn>
        <div className="grid gap-4 sm:grid-cols-2">
          <SeriesShowcase
            title="مستمرة"
            href="/search?status=ongoing"
            series={data.ongoing.slice(0, 6)}
            renderCard={(s) => <CyberCard key={s.id} series={s} />}
          />
          <SeriesShowcase
            title="ننصح لك بها"
            href="/search"
            series={data.recommended}
            renderCard={(s) => <CyberCard key={s.id} series={s} />}
          />
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
