import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Star, Eye, Bookmark, Heart, BookOpen, Calendar, User as UserIcon } from "lucide-react";
import {
  getSeriesBySlug,
  getChaptersBySeries,
  getCommentsForSeries,
  getGenres,
  getSeriesList,
} from "@/lib/mock/repo";
import { getMockDatabase } from "@/lib/mock/generate";
import { Badge } from "@/components/ui/badge";
import { BookmarkButton, ShareButton } from "@/components/series/bookmark-button";
import { ChapterList } from "@/components/series/chapter-list";
import { CommentSection } from "@/components/series/comment-section";
import { SeriesRow } from "@/components/shared/series-card";
import { FadeIn } from "@/components/motion/fade-in";
import { formatNumber, safeDecodeURIComponent } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  ongoing: "مستمر",
  completed: "مكتمل",
  hiatus: "متوقف مؤقتاً",
  dropped: "متروك",
};

const TYPE_LABEL: Record<string, string> = {
  manhwa: "مانهوا",
  manga: "مانجا",
  manhua: "مانها",
  novel: "رواية",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const series = await getSeriesBySlug(safeDecodeURIComponent(slug));
  if (!series) return { title: "غير موجود" };
  return {
    title: series.titleAr,
    description: series.synopsis,
    openGraph: { title: series.titleAr, description: series.synopsis, images: [series.cover] },
  };
}

export default async function SeriesDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const series = await getSeriesBySlug(safeDecodeURIComponent(slug));
  if (!series) notFound();

  const [chapters, comments, genres] = await Promise.all([
    getChaptersBySeries(series.id),
    getCommentsForSeries(series.id),
    getGenres(),
  ]);
  const db = getMockDatabase();
  const team = db.teams.find((t) => t.id === series.teamId);
  const seriesGenres = genres.filter((g) => series.genreIds.includes(g.id));
  const { items: related } = await getSeriesList({ genre: series.genreIds[0], pageSize: 6 });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: series.titleAr,
    author: series.author,
    genre: seriesGenres.map((g) => g.name),
    image: series.cover,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: series.rating,
      ratingCount: series.ratingCount,
    },
  };

  return (
    <div className="pb-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="relative h-64 w-full overflow-hidden sm:h-80">
        <Image src={series.banner} alt={series.titleAr} fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/70 to-[#09090B]/30" />
      </div>

      <div className="container -mt-24 space-y-8 sm:-mt-28">
        <FadeIn>
          <div className="flex flex-col gap-6 sm:flex-row">
            <div className="relative aspect-[3/4.2] w-40 shrink-0 overflow-hidden rounded-2xl border border-white/10 shadow-glow-lg sm:w-52">
              <Image src={series.cover} alt={series.titleAr} fill sizes="208px" className="object-cover" />
            </div>

            <div className="flex-1 space-y-3 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success">{STATUS_LABEL[series.status]}</Badge>
                <Badge variant="secondary">{TYPE_LABEL[series.type]}</Badge>
                {seriesGenres.slice(0, 4).map((g) => (
                  <Badge key={g.id} variant="outline">{g.nameAr}</Badge>
                ))}
              </div>
              <h1 className="font-display text-2xl font-black text-white sm:text-4xl">{series.titleAr}</h1>
              <p className="text-sm text-lunex-gray">{series.title}</p>

              <div className="flex flex-wrap items-center gap-4 text-sm text-lunex-gray">
                <span className="flex items-center gap-1 font-semibold text-amber-300">
                  <Star className="h-4 w-4 fill-amber-300" /> {series.rating} ({formatNumber(series.ratingCount)})
                </span>
                <span className="flex items-center gap-1"><Eye className="h-4 w-4" /> {formatNumber(series.views)}</span>
                <span className="flex items-center gap-1"><Bookmark className="h-4 w-4" /> {formatNumber(series.bookmarks)}</span>
                <span className="flex items-center gap-1"><Heart className="h-4 w-4" /> {formatNumber(series.likes)}</span>
                <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {series.year}</span>
                <span className="flex items-center gap-1"><UserIcon className="h-4 w-4" /> {series.author}</span>
              </div>

              <p className="max-w-3xl text-sm leading-relaxed text-lunex-gray">{series.synopsis}</p>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <a
                  href={`/series/${series.slug}/${chapters[chapters.length - 1]?.number ?? 1}`}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-lunex-gradient px-5 text-sm font-semibold text-white shadow-glow transition-transform hover:scale-[1.02]"
                >
                  <BookOpen className="h-4 w-4" /> ابدأ من الفصل الأول
                </a>
                {chapters[0] && (
                  <a
                    href={`/series/${series.slug}/${chapters[0].number}`}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/10"
                  >
                    أحدث فصل ({chapters[0].number})
                  </a>
                )}
                <BookmarkButton seriesId={series.id} />
                <ShareButton />
              </div>

              {team && (
                <Link
                  href={`/teams/${team.slug}`}
                  className="glass mt-2 inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs text-lunex-gray transition-colors hover:border-primary-400/40"
                >
                  ترجمة فريق <span className="font-semibold text-primary-300">{team.name}</span>
                </Link>
              )}

              <div className="flex flex-wrap gap-1.5 pt-1">
                {series.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-lunex-gray">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <FadeIn className="space-y-6">
            <h2 className="font-display text-xl font-bold text-white">الفصول ({chapters.length})</h2>
            <ChapterList seriesSlug={series.slug} chapters={chapters} />

            <h2 className="pt-4 font-display text-xl font-bold text-white">التعليقات ({comments.length})</h2>
            <CommentSection seriesId={series.id} initialComments={comments} users={db.users} />
          </FadeIn>

          <FadeIn className="space-y-4">
            <div className="glass rounded-2xl p-4">
              <h3 className="mb-3 font-display text-sm font-bold text-white">معلومات إضافية</h3>
              <dl className="space-y-2 text-sm">
                <Row label="الرسّام" value={series.artist} />
                <Row label="سنة الإصدار" value={String(series.year)} />
                <Row label="عدد الفصول" value={String(series.chapterCount)} />
                <Row label="العناوين البديلة" value={series.alternativeTitles.join("، ")} />
              </dl>
            </div>
          </FadeIn>
        </div>

        {related.length > 0 && (
          <FadeIn>
            <SeriesRow title="أعمال مشابهة" series={related.filter((s) => s.id !== series.id).slice(0, 6)} />
          </FadeIn>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-white/5 pb-2 last:border-0">
      <dt className="text-lunex-gray">{label}</dt>
      <dd className="text-end text-white">{value}</dd>
    </div>
  );
}
