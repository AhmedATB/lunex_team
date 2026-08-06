import { Sparkles } from "lucide-react";
import { HeroSlider } from "@/components/home/hero-slider";
import { StatsBar } from "@/components/home/stats-bar";
import { GenreGrid } from "@/components/home/genre-grid";
import { NewsSection } from "@/components/home/news-section";
import { TopReaders } from "@/components/home/top-readers";
import { LatestComments } from "@/components/home/latest-comments";
import { ContinueReading } from "@/components/home/continue-reading";
import { LatestChaptersGrid } from "@/components/home/latest-chapters-grid";
import { TrendingCarousel } from "@/components/home/trending-carousel";
import { SeriesRow, SeriesCard } from "@/components/shared/series-card";
import { FadeIn } from "@/components/motion/fade-in";
import { Badge } from "@/components/ui/badge";
import type { HomeLayoutData } from "./types";

/**
 * "المجلة" (Magazine) — the site's original layout: hero-first, a broad,
 * generously-sectioned tour through everything. Unchanged from before the
 * multi-template system existed, so this style carries zero visual
 * regression risk.
 */
export function VioletNightHome(data: HomeLayoutData) {
  return (
    <div className="container relative space-y-14 py-6">
      <FadeIn>
        <HeroSlider series={data.featured.length ? data.featured : data.trending.slice(0, 5)} />
      </FadeIn>

      <FadeIn delay={0.05}>
        <StatsBar stats={data.stats} />
      </FadeIn>

      <FadeIn>
        <ContinueReading />
      </FadeIn>

      <FadeIn>
        <LatestChaptersGrid chapters={data.latestChapters} />
      </FadeIn>

      <FadeIn>
        <SeriesRow title="الأكثر شعبية اليوم" href="/search?sort=views" series={data.popular} />
      </FadeIn>

      <FadeIn>
        <TrendingCarousel series={data.trending} />
      </FadeIn>

      <FadeIn>
        <SeriesRow title="تحديثات حديثة" href="/search?sort=latest" series={data.recentlyUpdated} />
      </FadeIn>

      <FadeIn>
        <SeriesRow title="إصدارات جديدة" href="/search?sort=latest" series={data.newReleases} />
      </FadeIn>

      <FadeIn>
        <div className="grid gap-4 sm:grid-cols-2">
          <SeriesRow title="مستمرة" href="/search?status=ongoing" series={data.ongoing.slice(0, 6)} className="sm:col-span-1" />
          <SeriesRow title="مكتملة" href="/search?status=completed" series={data.completed} className="sm:col-span-1" />
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

      <div className="magic-divider" />

      <FadeIn>
        <div className="magic-border relative overflow-hidden rounded-2xl bg-lunex-radial p-6 sm:p-8">
          <Sparkles className="absolute -top-4 end-6 h-24 w-24 text-primary-500/10" />
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Badge variant="outline" className="mb-2">اختيار عشوائي لليوم</Badge>
              <h3 className="font-display text-2xl font-bold text-white">{data.randomPick.titleAr}</h3>
              <p className="mt-1 max-w-lg text-sm text-lunex-gray line-clamp-2">{data.randomPick.synopsis}</p>
            </div>
            <div className="w-32 shrink-0 sm:w-40">
              <SeriesCard series={data.randomPick} />
            </div>
          </div>
        </div>
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
