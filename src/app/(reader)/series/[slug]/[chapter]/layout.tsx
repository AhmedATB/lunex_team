import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/seo/json-ld";
import { loadCatalog } from "@/lib/catalog-server";
import { SITE_NAME, breadcrumbJsonLd, chapterDescription, chapterJsonLd, chapterPath, coverUrl, displayTitle, seriesPath } from "@/lib/seo";
import { safeDecodeURIComponent } from "@/lib/utils";

type Props = { params: Promise<{ slug: string; chapter: string }> };

async function find({ slug, chapter }: { slug: string; chapter: string }) {
  const db = await loadCatalog();
  const wanted = safeDecodeURIComponent(slug);
  const series = db.series.find((s) => s.slug === wanted);
  const number = Number(safeDecodeURIComponent(chapter));
  // A number the work has not reached (or is not a number) is a chapter that does not exist — or a draft only its team can open —
  // so it is kept out of search results. Anything up to the latest chapter is left indexable, even when the catalogue is a
  // moment behind a chapter that was just published.
  const exists = !!series && Number.isFinite(number) && number > 0 && number <= (series.latestChapterNumber ?? 0);
  return { series, number, exists };
}

/** A chapter's own title and description for search results and link previews (the page draws in the browser, so its head is written here). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { series, number, exists } = await find(await params);
  if (!series) return { robots: { index: false, follow: false } };
  if (!exists) return { title: displayTitle(series), robots: { index: false, follow: true } };
  const title = `${series.titleAr || series.title} الفصل ${number} مترجم`;
  const description = chapterDescription(series, number);
  return {
    title,
    description,
    alternates: { canonical: chapterPath(series.slug, number) },
    openGraph: { type: "website", siteName: SITE_NAME, locale: "ar_AR", url: chapterPath(series.slug, number), title, description, images: [{ url: coverUrl(series), alt: series.titleAr || series.title }] },
    twitter: { card: "summary", title, description, images: [coverUrl(series)] },
  };
}

export default async function ChapterLayout({ children, params }: Props & { children: ReactNode }) {
  const { series, number, exists } = await find(await params);
  if (!series || !exists) return children;
  const name = series.titleAr || series.title;
  return (
    <>
      {/* What the reader's toolbar says, as text a crawler reads: which chapter this is, of which work, and the way back. */}
      <div className="sr-only">
        <h1>
          {displayTitle(series)} — الفصل {number} مترجم
        </h1>
        <p>{chapterDescription(series, number)}</p>
        <a href={seriesPath(series.slug)}>جميع فصول {name}</a>
      </div>
      {children}
      <JsonLd data={chapterJsonLd(series, number)} />
      <JsonLd data={breadcrumbJsonLd([{ name: SITE_NAME, path: "/" }, { name: "الأعمال", path: "/series" }, { name, path: seriesPath(series.slug) }, { name: `الفصل ${number}`, path: chapterPath(series.slug, number) }])} />
    </>
  );
}
