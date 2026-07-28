import {
  getFeaturedSeries,
  getLatestChapters,
  getPopularToday,
  getTrendingSeries,
  getRecentlyUpdated,
  getNewReleases,
  getCompletedSeries,
  getOngoingSeries,
  getRecommendedSeries,
  getGenres,
  getRandomPick,
  getNews,
  getTopReaders,
  getPlatformStats,
} from "@/lib/mock/repo";
import { getMockDatabase } from "@/lib/mock/generate";
import { HeroSlider } from "@/components/home/hero-slider";
import { StatsBar } from "@/components/home/stats-bar";
import { GenreGrid } from "@/components/home/genre-grid";
import { NewsSection } from "@/components/home/news-section";
import { TopReaders } from "@/components/home/top-readers";
import { LatestComments } from "@/components/home/latest-comments";
import { ContinueReading } from "@/components/home/continue-reading";
import { SeriesRow, SeriesCard } from "@/components/shared/series-card";
import { FadeIn } from "@/components/motion/fade-in";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";

export default async function HomePage() {
  const [
    featured,
    latestChapters,
    popular,
    trending,
    recentlyUpdated,
    newReleases,
    completed,
    ongoing,
    recommended,
    genres,
    randomPick,
    news,
    topReaders,
    stats,
  ] = await Promise.all([
    getFeaturedSeries(6),
    getLatestChapters(12),
    getPopularToday(6),
    getTrendingSeries(10),
    getRecentlyUpdated(12),
    getNewReleases(12),
    getCompletedSeries(6),
    getOngoingSeries(12),
    getRecommendedSeries(6),
    getGenres(),
    getRandomPick(),
    getNews(6),
    getTopReaders(8),
    getPlatformStats(),
  ]);

  const db = getMockDatabase();
  const latestComments = [...db.comments]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 6);
  const seriesMap = new Map(db.series.map((s) => [s.id, s]));

  return (
    <div className="container space-y-14 py-6">
      <FadeIn>
        <HeroSlider series={featured.length ? featured : trending.slice(0, 5)} />
      </FadeIn>

      <FadeIn delay={0.05}>
        <StatsBar stats={stats} />
      </FadeIn>

      <FadeIn>
        <ContinueReading />
      </FadeIn>

      <FadeIn>
        <section className="space-y-4">
          <h2 className="font-display text-xl font-bold text-white sm:text-2xl">آخر تحديثات الفصول</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {latestChapters.map((c) => (
              <Link
                key={c.id}
                href={`/series/${c.series.slug}/${c.number}`}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl transition-all hover:-translate-y-1 hover:border-primary-400/40 hover:shadow-glow"
              >
                <div className="relative aspect-[3/4.2] w-full overflow-hidden">
                  <Image
                    src={c.series.cover}
                    alt={c.series.titleAr}
                    fill
                    sizes="(max-width: 768px) 45vw, 16vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                  <Badge className="absolute start-2 top-2">جديد</Badge>
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <p className="line-clamp-1 text-xs font-bold text-white">{c.series.titleAr}</p>
                    <p className="text-[11px] text-primary-300">الفصل {c.number}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </FadeIn>

      <FadeIn>
        <SeriesRow title="الأكثر شعبية اليوم" href="/search?sort=views" series={popular} />
      </FadeIn>

      <FadeIn>
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-white sm:text-2xl">الرائجة</h2>
            <Link href="/search?sort=views" className="text-sm font-medium text-primary-300 hover:text-primary-200">
              عرض الكل ←
            </Link>
          </div>
          <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
            {trending.map((s, i) => (
              <Link
                key={s.id}
                href={`/series/${s.slug}`}
                className="group relative flex w-40 shrink-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] sm:w-48"
              >
                <span className="absolute start-0 top-0 z-10 flex h-9 w-9 items-center justify-center bg-lunex-gradient font-display text-lg font-black text-white [clip-path:polygon(0_0,100%_0,0_100%)]">
                  {i + 1}
                </span>
                <div className="relative aspect-[3/4.2] w-full overflow-hidden">
                  <Image
                    src={s.cover}
                    alt={s.titleAr}
                    fill
                    sizes="160px"
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                  <p className="absolute inset-x-0 bottom-0 line-clamp-2 p-3 text-xs font-bold text-white">
                    {s.titleAr}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </FadeIn>

      <FadeIn>
        <SeriesRow title="تحديثات حديثة" href="/search?sort=latest" series={recentlyUpdated} />
      </FadeIn>

      <FadeIn>
        <SeriesRow title="إصدارات جديدة" href="/search?sort=latest" series={newReleases} />
      </FadeIn>

      <FadeIn>
        <div className="grid gap-4 sm:grid-cols-2">
          <SeriesRow title="مستمرة" href="/search?status=ongoing" series={ongoing.slice(0, 6)} className="sm:col-span-1" />
          <SeriesRow title="مكتملة" href="/search?status=completed" series={completed} className="sm:col-span-1" />
        </div>
      </FadeIn>

      <FadeIn>
        <SeriesRow title="ننصح لك بها" href="/search" series={recommended} />
      </FadeIn>

      <FadeIn>
        <section className="space-y-4">
          <h2 className="font-display text-xl font-bold text-white sm:text-2xl">تصفح حسب التصنيف</h2>
          <GenreGrid genres={genres} />
        </section>
      </FadeIn>

      <FadeIn>
        <div className="relative overflow-hidden rounded-2xl border border-primary-500/30 bg-lunex-radial p-6 sm:p-8">
          <Sparkles className="absolute -top-4 end-6 h-24 w-24 text-primary-500/10" />
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Badge variant="outline" className="mb-2">اختيار عشوائي لليوم</Badge>
              <h3 className="font-display text-2xl font-bold text-white">{randomPick.titleAr}</h3>
              <p className="mt-1 max-w-lg text-sm text-lunex-gray line-clamp-2">{randomPick.synopsis}</p>
            </div>
            <div className="w-32 shrink-0 sm:w-40">
              <SeriesCard series={randomPick} />
            </div>
          </div>
        </div>
      </FadeIn>

      <FadeIn>
        <NewsSection news={news} />
      </FadeIn>

      <div className="grid gap-8 lg:grid-cols-2">
        <FadeIn>
          <TopReaders users={topReaders} />
        </FadeIn>
        <FadeIn>
          <LatestComments comments={latestComments} users={db.users} seriesMap={seriesMap} />
        </FadeIn>
      </div>
    </div>
  );
}
