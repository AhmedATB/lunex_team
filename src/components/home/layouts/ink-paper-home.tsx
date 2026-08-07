import { StatsBar } from "@/components/home/stats-bar";
import { GenreGrid } from "@/components/home/genre-grid";
import { NewsSection } from "@/components/home/news-section";
import { TopReaders } from "@/components/home/top-readers";
import { LatestComments } from "@/components/home/latest-comments";
import { ContinueReading } from "@/components/home/continue-reading";
import { LatestChaptersList } from "@/components/home/latest-chapters-list";
import { PaperListItem } from "@/components/shared/series-cards/paper-list-item";
import { FadeIn } from "@/components/motion/fade-in";
import type { HomeLayoutData } from "./types";

/**
 * "الفهرس" (Editorial Index) — text-forward and list-based throughout, not
 * just for chapters: every series display here uses PaperListItem (a
 * reading-list row, no card/cover wall) so the whole page reads like a
 * table of contents rather than a gallery.
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

      <div className="grid gap-8 lg:grid-cols-2">
        <FadeIn>
          <section className="space-y-2">
            <h2 className="section-title font-display text-xl font-bold text-white sm:text-2xl">الأكثر شعبية اليوم</h2>
            <div className="panel divide-y divide-white/5 px-3">
              {data.popular.map((s) => (
                <PaperListItem key={s.id} series={s} />
              ))}
            </div>
          </section>
        </FadeIn>
        <FadeIn>
          <section className="space-y-2">
            <h2 className="section-title font-display text-xl font-bold text-white sm:text-2xl">تحديثات حديثة</h2>
            <div className="panel divide-y divide-white/5 px-3">
              {data.recentlyUpdated.slice(0, 8).map((s) => (
                <PaperListItem key={s.id} series={s} />
              ))}
            </div>
          </section>
        </FadeIn>
      </div>

      <FadeIn>
        <section className="space-y-2">
          <h2 className="section-title font-display text-xl font-bold text-white sm:text-2xl">ننصح لك بها</h2>
          <div className="panel divide-y divide-white/5 px-3">
            {data.recommended.map((s) => (
              <PaperListItem key={s.id} series={s} />
            ))}
          </div>
        </section>
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
