import { StatsBar } from "@/components/home/stats-bar";
import { GenreGrid } from "@/components/home/genre-grid";
import { NewsSection } from "@/components/home/news-section";
import { TopReaders } from "@/components/home/top-readers";
import { LatestComments } from "@/components/home/latest-comments";
import { ContinueReading } from "@/components/home/continue-reading";
import { LatestChaptersGrid } from "@/components/home/latest-chapters-grid";
import { BloodCard } from "@/components/shared/series-cards/blood-card";
import { SeriesShowcase } from "@/components/shared/series-showcase";
import { FadeIn } from "@/components/motion/fade-in";
import type { HomeLayoutData } from "./types";

/**
 * "ساحة المعركة" (Battle Wall) — opens directly on a ranked roster, no
 * hero, no warm-up. Every series display uses BloodCard (clipped corner,
 * thick border, stamped rank badge) for a consistent "combatant card" feel
 * throughout, not just the leaderboard section.
 */
export function CrimsonBloodHome(data: HomeLayoutData) {
  return (
    <div className="container relative space-y-12 py-6">
      <FadeIn>
        <SeriesShowcase
          title="الأقوى الآن"
          series={data.trending}
          renderCard={(s, i) => <BloodCard key={s.id} series={s} rank={i + 1} />}
        />
      </FadeIn>

      <FadeIn delay={0.05}>
        <StatsBar stats={data.stats} />
      </FadeIn>

      <FadeIn>
        <SeriesShowcase
          title="الأكثر شعبية اليوم"
          href="/search?sort=views"
          series={data.popular}
          renderCard={(s, i) => <BloodCard key={s.id} series={s} rank={i + 1} />}
        />
      </FadeIn>

      <FadeIn>
        <ContinueReading />
      </FadeIn>

      <FadeIn>
        <LatestChaptersGrid chapters={data.latestChapters} />
      </FadeIn>

      <FadeIn>
        <SeriesShowcase
          title="تحديثات حديثة"
          href="/search?sort=latest"
          series={data.recentlyUpdated}
          renderCard={(s) => <BloodCard key={s.id} series={s} />}
        />
      </FadeIn>

      <FadeIn>
        <SeriesShowcase
          title="إصدارات جديدة"
          href="/search?sort=latest"
          series={data.newReleases}
          renderCard={(s) => <BloodCard key={s.id} series={s} />}
        />
      </FadeIn>

      <FadeIn>
        <SeriesShowcase
          title="ننصح لك بها"
          href="/search"
          series={data.recommended}
          renderCard={(s) => <BloodCard key={s.id} series={s} />}
        />
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
