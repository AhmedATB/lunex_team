import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/seo/json-ld";
import { loadCatalog, loadSitemapIndex } from "@/lib/catalog-server";
import { SITE_NAME, breadcrumbJsonLd, chapterPath, coverUrl, displayTitle, seriesDescription, seriesJsonLd, seriesPath } from "@/lib/seo";
import { safeDecodeURIComponent } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

/** The most chapter links a work's page hands to crawlers (the newest ones): the sitemap lists them all. */
const CHAPTER_LINKS = 400;

async function findSeries(slugParam: string) {
  const db = await loadCatalog();
  const slug = safeDecodeURIComponent(slugParam);
  return { db, series: db.series.find((s) => s.slug === slug) };
}

/**
 * What search engines and link previews read about a work — its own title, description and cover, in the page's head — is
 * written here on the server; the page itself draws in the browser. Without this every work would share the site's one title.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { series } = await findSeries((await params).slug);
  if (!series) return { robots: { index: false, follow: false } };
  const title = `${displayTitle(series)} مترجم`;
  const description = seriesDescription(series);
  return {
    title,
    description,
    alternates: { canonical: seriesPath(series.slug) },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "ar_AR",
      url: seriesPath(series.slug),
      title,
      description,
      images: [{ url: coverUrl(series), alt: series.titleAr || series.title }],
    },
    twitter: { card: "summary", title, description, images: [coverUrl(series)] },
  };
}

export default async function SeriesLayout({ children, params }: Props & { children: ReactNode }) {
  const { db, series } = await findSeries((await params).slug);
  if (!series) return children;

  const genres = series.genreIds.flatMap((id) => db.genres.find((g) => g.id === id)?.nameAr ?? []);
  const index = await loadSitemapIndex();
  const chapters = (index?.find((s) => s.slug === series.slug)?.chapters ?? []).slice(-CHAPTER_LINKS).reverse();

  return (
    <>
      {children}
      <JsonLd data={seriesJsonLd(series, genres)} />
      <JsonLd data={breadcrumbJsonLd([{ name: SITE_NAME, path: "/" }, { name: "الأعمال", path: "/series" }, { name: series.titleAr || series.title, path: seriesPath(series.slug) }])} />
      {chapters.length > 0 && (
        // The same chapter list the page draws for readers, as plain links a crawler can follow without running the page's code.
        <nav aria-label={`فصول ${series.titleAr}`} className="sr-only">
          <h2>فصول {displayTitle(series)} مترجمة</h2>
          <ul>
            {chapters.map((c) => (
              <li key={c.number}>
                <a href={chapterPath(series.slug, c.number)}>{series.titleAr} الفصل {c.number}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}
