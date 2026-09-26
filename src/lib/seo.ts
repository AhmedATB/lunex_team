import { SITE_URL } from "@/lib/site";
import type { Series, SeriesStatus, Team } from "@/lib/types";

/**
 * What search engines and link previews read about a page: titles, descriptions, other names and structured data. The pages
 * themselves draw on the browser, so these are built on the server, from the same catalogue the pages use.
 */

export const SITE_NAME = "LUNEX TEAM";

export const absoluteUrl = (path: string) => (/^https?:\/\//.test(path) ? path : `${SITE_URL}${path}`);
export const seriesPath = (slug: string) => `/series/${encodeURIComponent(slug)}`;
export const chapterPath = (slug: string, number: number) => `${seriesPath(slug)}/${number}`;
export const teamPath = (slug: string) => `/teams/${encodeURIComponent(slug)}`;

export const TYPE_LABEL_AR: Record<string, string> = { manhwa: "مانهوا", manga: "مانجا", manhua: "مانها", novel: "رواية" };
export const STATUS_LABEL_AR: Record<SeriesStatus, string> = { ongoing: "مستمر", completed: "مكتمل", hiatus: "متوقف مؤقتًا", dropped: "متروك" };

/** One line of plain text, cut to fit where a snippet is shown. */
export function clip(text: string, max: number): string {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length <= max ? one : `${one.slice(0, max - 1).trimEnd()}…`;
}

const fold = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** "وردة القمر (Moon Rose)": the Arabic name, and the Latin one when it is a different name. */
export function displayTitle(series: Pick<Series, "titleAr" | "title">): string {
  const ar = series.titleAr?.trim() ?? "";
  const en = series.title?.trim() ?? "";
  if (ar && en && fold(ar) !== fold(en)) return `${ar} (${en})`;
  return ar || en;
}

const ARABIC = /[؀-ۿ]/;

/**
 * The same name as other people spell it: Arabic with the hamza, ta marbuta and ya variants people mix up, and a Latin name
 * without its punctuation ("Re:Zero" → "re zero"). Only ever offered as structured data — a search engine already treats these
 * as near matches, and this states it — never as text on the page.
 */
export function spellingVariants(name: string): string[] {
  const out = new Set<string>();
  if (ARABIC.test(name)) {
    const hamza = name.replace(/[أإآ]/g, "ا");
    const marbuta = name.replace(/ة/g, "ه");
    const ya = name.replace(/ى/g, "ي");
    for (const variant of [hamza, marbuta, ya, hamza.replace(/ة/g, "ه").replace(/ى/g, "ي")]) out.add(variant);
  } else {
    const plain = fold(name);
    if (plain && plain !== name.toLowerCase().trim()) out.add(plain);
  }
  out.delete(name);
  return [...out];
}

/** Every other name a work is known by: the ones the editors wrote down, the Latin title, and the spelling variants of them. */
export function alternateNames(series: Pick<Series, "titleAr" | "title" | "alternativeTitles">): string[] {
  const primary = series.titleAr?.trim() || series.title?.trim() || "";
  const written = [series.title, ...(series.alternativeTitles ?? [])].map((t) => t?.trim()).filter((t): t is string => !!t);
  const all = [...written, ...[primary, ...written].flatMap(spellingVariants)];
  return [...new Set(all)].filter((name) => name !== primary).slice(0, 14);
}

export function seriesDescription(series: Series): string {
  const kind = TYPE_LABEL_AR[series.type] ?? "عمل";
  const status = STATUS_LABEL_AR[series.status];
  const facts = [kind, status, series.chapterCount > 0 ? `${series.chapterCount} فصل` : null].filter(Boolean).join(" · ");
  return clip(`اقرأ ${displayTitle(series)} مترجمًا للعربية أونلاين على ${SITE_NAME} — ${facts}. ${series.synopsis}`, 200);
}

export function chapterDescription(series: Series, number: number): string {
  return clip(`اقرأ الفصل ${number} من ${displayTitle(series)} مترجمًا للعربية أونلاين على ${SITE_NAME}. ${series.synopsis}`, 200);
}

/** The picture a link preview shows for a work (a cover is always the site's own address). */
export const coverUrl = (series: Pick<Series, "cover">) => absoluteUrl(series.cover);

export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: absoluteUrl(item.path) })),
  };
}

export function seriesJsonLd(series: Series, genres: string[]) {
  return {
    "@context": "https://schema.org",
    "@type": series.type === "novel" ? "BookSeries" : "ComicSeries",
    name: series.titleAr || series.title,
    alternateName: alternateNames(series),
    url: absoluteUrl(seriesPath(series.slug)),
    image: coverUrl(series),
    description: clip(series.synopsis || seriesDescription(series), 300),
    inLanguage: "ar",
    ...(genres.length > 0 ? { genre: genres } : {}),
    ...(series.author ? { author: { "@type": "Person", name: series.author } } : {}),
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    ...(series.ratingCount > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: series.rating, ratingCount: series.ratingCount, bestRating: 5, worstRating: 1 } } : {}),
  };
}

export function chapterJsonLd(series: Series, number: number) {
  return {
    "@context": "https://schema.org",
    "@type": series.type === "novel" ? "Chapter" : "ComicIssue",
    name: `${series.titleAr || series.title} — الفصل ${number}`,
    ...(series.type === "novel" ? { position: number } : { issueNumber: number }),
    url: absoluteUrl(chapterPath(series.slug, number)),
    image: coverUrl(series),
    inLanguage: "ar",
    isPartOf: { "@type": series.type === "novel" ? "BookSeries" : "ComicSeries", name: series.titleAr || series.title, url: absoluteUrl(seriesPath(series.slug)) },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };
}

export function teamJsonLd(team: Team) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: team.name,
    url: absoluteUrl(teamPath(team.slug)),
    ...(team.logoUrl ? { logo: absoluteUrl(team.logoUrl) } : {}),
    ...(team.description ? { description: clip(team.description, 300) } : {}),
    ...(team.discordUrl ? { sameAs: [team.discordUrl] } : {}),
  };
}
