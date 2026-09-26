import Image from "next/image";
import { ResponsiveBanner } from "@/components/ads/ad-unit";
import Link from "next/link";
import { Star, Sparkles, Megaphone, Calendar, Newspaper } from "lucide-react";
import type { Series, NewsItem } from "@/lib/types";
import type { HomeLayoutData } from "./types";
import { GenreGrid } from "@/components/home/genre-grid";
import { pickEssentialGenres } from "@/lib/essential-genres";
import { TopReaders } from "@/components/home/top-readers";
import { LatestComments } from "@/components/home/latest-comments";
import { ContinueReading } from "@/components/home/continue-reading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatNumber, formatRating, timeAgo } from "@/lib/utils";

const NEWS_ICON: Record<string, typeof Megaphone> = {
  announcement: Megaphone,
  event: Calendar,
  news: Newspaper,
};
const NEWS_LABEL: Record<string, string> = {
  announcement: "إعلان",
  event: "فعالية",
  news: "خبر",
};

/** Fills its (relatively-positioned) parent; `scrim` darkens it so overlaid text stays legible. */
function Cover({ src, alt, sizes, priority, scrim }: { src: string; alt: string; sizes: string; priority?: boolean; scrim?: boolean }) {
  return (
    <>
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
      {scrim && <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/5" />}
    </>
  );
}

function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="section-title font-display text-xl font-bold text-white sm:text-2xl">{title}</h2>
      {href && (
        <Link href={href} className="text-sm font-medium text-primary-300 hover:text-primary-200">
          عرض الكل ←
        </Link>
      )}
    </div>
  );
}

function RatingPill({ series, className }: { series: Series; className?: string }) {
  return (
    <span className={cn("flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-amber-300", className)}>
      <Star className="h-3 w-3 fill-amber-300" /> {formatRating(series.rating, series.ratingCount)}
    </span>
  );
}

const ROW_SIZES = "(min-width: 1024px) 16vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw";

/** A grid of portrait covers — used for ongoing, completed and new releases. */
function SeriesGridSection({ title, href, series }: { title: string; href: string; series: Series[] }) {
  return (
    <section className="space-y-4">
      <SectionHeader title={title} href={href} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {series.map((s) => (
          <Link key={s.id} href={`/series/${s.slug}`} className="group flex flex-col gap-2">
            <div className="panel panel-hover relative aspect-[3/4] w-full overflow-hidden">
              <Cover src={s.cover} alt={s.titleAr} sizes={ROW_SIZES} />
              <RatingPill series={s} className="absolute end-2 top-2 z-10" />
            </div>
            <span className="line-clamp-2 text-sm font-bold text-white group-hover:text-primary-300">{s.titleAr}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** A horizontally scrolling, numbered row of covers. */
function CarouselSection({ title, href, series }: { title: string; href: string; series: Series[] }) {
  return (
    <section className="space-y-4">
      <SectionHeader title={title} href={href} />
      <div className="flex gap-4 overflow-x-auto pb-1">
        {series.map((s, i) => (
          <Link key={s.id} href={`/series/${s.slug}`} className="group flex w-40 shrink-0 flex-col gap-2 sm:w-48">
            <div className="panel panel-hover relative aspect-[3/4] w-full overflow-hidden">
              <Cover src={s.cover} alt={s.titleAr} sizes="192px" />
              <span className="absolute start-2 top-2 z-10 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-primary-300">
                {String(i + 1).padStart(2, "0")}
              </span>
              <RatingPill series={s} className="absolute end-2 top-2 z-10" />
            </div>
            <span className="line-clamp-2 text-sm font-bold text-white group-hover:text-primary-300">{s.titleAr}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function NewsGrid({ news }: { news: NewsItem[] }) {
  return (
    <section className="space-y-4">
      <SectionHeader title="أخبار وفعاليات الفريق" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {news.map((n) => {
          const Icon = NEWS_ICON[n.category] ?? Newspaper;
          return (
            <div key={n.id} className="panel panel-hover overflow-hidden">
              <div className="relative aspect-[16/9] w-full overflow-hidden">
                <Cover src={n.cover} alt={n.title} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
                <Icon className="absolute end-3 bottom-3 h-5 w-5 text-white/70" />
                <Badge variant="secondary" className="absolute start-2 top-2">{NEWS_LABEL[n.category] ?? n.category}</Badge>
              </div>
              <div className="flex flex-col gap-1 p-4">
                <span className="line-clamp-2 text-sm font-bold text-white">{n.title}</span>
                <span className="text-xs text-lunex-gray">{timeAgo(n.createdAt)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * "تحريري" (Editorial) — the site's homepage layout for every theme: one
 * large lead story with smaller secondary stories at deliberately different
 * sizes, then sections that vary in shape (numbered list, asymmetric grid,
 * carousel, editor's picks) instead of a stack of identical rows. All colors
 * come from theme tokens, so it follows whichever style the reader picked.
 */
export function EditorialHome(data: HomeLayoutData) {
  const lead = data.featured[0] ?? data.trending[0];
  const secondary = data.featured.length > 1 ? data.featured.slice(1, 4) : data.trending.slice(1, 4);
  const topTrending = data.trending.slice(0, 6);
  const [heroUpdate, ...restUpdates] = data.latestChapters.slice(0, 5);
  const picks = data.recommended.slice(0, 3);

  return (
    <div className="container space-y-14 py-6">
      {lead && (
        <div className="flex flex-col gap-4 lg:h-[400px] lg:flex-row">
          <Link
            href={`/series/${lead.slug}`}
            className="panel panel-hover relative flex min-h-[320px] flex-1 flex-col justify-end gap-3 overflow-hidden p-6 lg:flex-[1.7] lg:p-8"
          >
            <Cover src={lead.cover} alt={lead.titleAr} sizes="(min-width: 1024px) 55vw, 100vw" priority scrim />
            <span className="relative z-10 w-fit rounded-full bg-lunex-gradient px-3 py-1 text-xs font-bold text-white">
              حصري LUNEX
            </span>
            <h1 className="relative z-10 font-display text-3xl font-black text-white lg:text-4xl">{lead.titleAr}</h1>
            <p className="relative z-10 line-clamp-2 max-w-xl text-sm text-white/80">{lead.synopsis}</p>
            <div className="relative z-10 flex items-center gap-3">
              <span className="inline-flex h-12 items-center justify-center rounded-xl bg-lunex-gradient px-8 text-base font-bold text-white shadow-[0_4px_20px_-2px_rgb(var(--primary-600)/0.55)]">
                ابدأ القراءة
              </span>
              <RatingPill series={lead} className="px-2.5 py-1 text-sm" />
            </div>
          </Link>

          <div className="flex gap-3 overflow-x-auto lg:flex-1 lg:flex-col lg:overflow-visible">
            {secondary.map((s) => (
              <Link
                key={s.id}
                href={`/series/${s.slug}`}
                className="panel panel-hover flex w-64 shrink-0 gap-3 p-3 lg:w-auto lg:flex-1"
              >
                <div className="relative h-full min-h-[72px] w-16 shrink-0 overflow-hidden rounded-lg">
                  <Cover src={s.cover} alt={s.titleAr} sizes="64px" />
                </div>
                <div className="flex flex-col justify-center gap-1">
                  <span className="line-clamp-1 text-sm font-bold text-white">{s.titleAr}</span>
                  <span className="flex w-fit items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-bold text-amber-300">
                    <Star className="h-3 w-3 fill-amber-300" /> {formatRating(s.rating, s.ratingCount)}
                  </span>
                  <span className="text-xs text-lunex-gray">{formatNumber(s.views)} مشاهدة</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="panel flex flex-wrap items-center justify-between gap-4 px-6 py-4 sm:flex-nowrap">
        {[
          { label: "سلسلة", value: data.stats.totalSeries },
          { label: "فصل منشور", value: data.stats.totalChapters },
          { label: "قارئ مسجل", value: data.stats.totalUsers },
          { label: "تعليق", value: data.stats.totalComments },
          { label: "مشاهدة إجمالية", value: data.stats.totalViews },
        ].map((stat, i) => (
          <div key={stat.label} className={i === 0 ? "" : "border-s border-border ps-4"}>
            <span className="font-display text-lg font-bold text-white">{formatNumber(stat.value)}</span>{" "}
            <span className="text-sm text-lunex-gray">{stat.label}</span>
          </div>
        ))}
      </div>

      <ContinueReading />

      <ResponsiveBanner />

      <section className="space-y-4">
        <SectionHeader title="الأكثر قراءة هذا الأسبوع" href="/search?sort=trending" />
        <div className="grid gap-3 sm:grid-cols-2">
          {topTrending.map((s, i) => (
            <Link key={s.id} href={`/series/${s.slug}`} className="group flex items-center gap-4">
              <span className="w-11 shrink-0 font-display text-3xl font-extrabold text-border transition-colors group-hover:text-primary-400">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="relative h-[66px] w-[50px] shrink-0 overflow-hidden rounded-lg">
                <Cover src={s.cover} alt={s.titleAr} sizes="50px" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-white group-hover:text-primary-300">{s.titleAr}</span>
                <span className="text-xs text-lunex-gray">
                  ★ {formatRating(s.rating, s.ratingCount)} &middot; {formatNumber(s.views)} مشاهدة
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="آخر تحديثات الفصول" href="/search?sort=latest" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {heroUpdate && (
            <Link
              href={`/series/${heroUpdate.series.slug}/${heroUpdate.number}`}
              className="panel panel-hover relative col-span-2 row-span-2 flex min-h-[220px] flex-col justify-end overflow-hidden p-4 sm:min-h-[280px]"
            >
              <Cover src={heroUpdate.series.cover} alt={heroUpdate.series.titleAr} sizes="(min-width: 640px) 50vw, 100vw" scrim />
              <span className="relative z-10 mb-1 w-fit rounded-full bg-primary-400/30 px-2 py-0.5 text-[11px] font-bold text-white">جديد</span>
              <span className="relative z-10 font-display text-lg font-bold text-white">{heroUpdate.series.titleAr}</span>
              <span className="relative z-10 text-xs text-white/70">الفصل {heroUpdate.number}</span>
            </Link>
          )}
          {restUpdates.map((c) => (
            <Link
              key={c.id}
              href={`/series/${c.series.slug}/${c.number}`}
              className="panel panel-hover relative flex min-h-[130px] flex-col justify-end overflow-hidden p-3"
            >
              <Cover src={c.series.cover} alt={c.series.titleAr} sizes="(min-width: 640px) 25vw, 50vw" scrim />
              <span className="relative z-10 line-clamp-1 text-xs font-bold text-white">{c.series.titleAr}</span>
              <span className="relative z-10 text-[11px] text-white/70">الفصل {c.number}</span>
            </Link>
          ))}
        </div>
      </section>

      <CarouselSection title="الأكثر شعبية" href="/search?sort=popular" series={data.popular} />

      <div className="grid gap-10 lg:grid-cols-2">
        <SeriesGridSection title="مستمرة" href="/search?status=ongoing" series={data.ongoing.slice(0, 6)} />
        <SeriesGridSection title="مكتملة" href="/search?status=completed" series={data.completed.slice(0, 6)} />
      </div>

      <SeriesGridSection title="إصدارات جديدة" href="/search?sort=latest" series={data.newReleases.slice(0, 6)} />

      {picks.length > 0 && (
        <section className="space-y-4">
          <SectionHeader title="اختيارات المحررين" href="/search" />
          <div className="grid gap-4 sm:grid-cols-3">
            {picks.map((s) => (
              <Link key={s.id} href={`/series/${s.slug}`} className="panel panel-hover group flex flex-col overflow-hidden">
                <div className="relative aspect-[16/9] w-full overflow-hidden">
                  <Cover src={s.cover} alt={s.titleAr} sizes="(min-width: 640px) 33vw, 100vw" />
                </div>
                <div className="flex flex-col gap-2 p-4">
                  <span className="font-display text-base font-bold text-white group-hover:text-primary-300">{s.titleAr}</span>
                  <p className="line-clamp-2 text-xs text-lunex-gray">{s.synopsis}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="panel relative grid gap-6 overflow-hidden p-6 sm:grid-cols-[220px_1fr] sm:p-8">
        <Sparkles className="absolute -top-4 end-6 h-24 w-24 text-primary-500/10" />
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl sm:w-[220px]">
          <Cover src={data.randomPick.cover} alt={data.randomPick.titleAr} sizes="220px" />
        </div>
        <div className="flex flex-col justify-center gap-3">
          <Badge variant="outline" className="w-fit">اختيار عشوائي لليوم</Badge>
          <h3 className="font-display text-2xl font-bold text-white">{data.randomPick.titleAr}</h3>
          <p className="line-clamp-3 max-w-lg text-sm text-lunex-gray">{data.randomPick.synopsis}</p>
          <Button asChild variant="secondary" className="w-fit">
            <Link href={`/series/${data.randomPick.slug}`}>اقرأ الآن</Link>
          </Button>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="section-title font-display text-xl font-bold text-white sm:text-2xl">تصفح حسب التصنيف</h2>
        <GenreGrid genres={pickEssentialGenres(data.genres, data.seriesMap.values())} showAllHref="/search" />
      </section>

      <NewsGrid news={data.news} />

      <div className="grid gap-8 lg:grid-cols-2">
        <TopReaders users={data.topReaders} />
        <LatestComments comments={data.latestComments} users={data.users} seriesMap={data.seriesMap} />
      </div>
    </div>
  );
}
