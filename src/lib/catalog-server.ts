import "server-only";
import { cache } from "react";
import { BACKEND_URL } from "@/lib/backend-client";
import { identityHeaders } from "@/lib/backend-identity";
import { mockCatalog, seedToCatalog } from "@/lib/catalog-build";
import type { Catalog, CatalogPerson, CatalogSeed } from "@/lib/catalog-types";
import type { Chapter, Genre, NewsItem, Series, Team, User } from "@/lib/types";

/** Shape of GET /v1/catalog/bootstrap (see CatalogService.bootstrap in the backend). */
interface Bootstrap {
  tags: { id: string; slug: string; name: string; nameAr: string; group: string }[];
  teams: Team[];
  people: CatalogPerson[];
  series: Series[];
  recentChapters: Chapter[];
  news: NewsItem[];
  topReaders: CatalogPerson[];
  stats: { members: number; comments: number; chapters: number };
}

const GENRE_GROUPS = new Set(["genre", "theme"]);

function asUser(p: CatalogPerson): User {
  return { ...p, teamRole: p.teamRole as User["teamRole"], role: p.role as User["role"] };
}

/**
 * The site's data for one request: series, teams, tags, latest chapters, news,
 * and the people teams and rankings refer to. One backend call, cached for a
 * few seconds by Next and memoised per request, so the layout and a page that
 * both ask for it cost a single fetch.
 *
 * Returns null when the database has no series yet (or the backend cannot be
 * reached): the site then falls back to its built-in sample data instead of
 * rendering an empty catalogue. That fallback goes away once the real catalogue
 * has been imported.
 */
export const loadCatalogSeed = cache(async (): Promise<CatalogSeed | null> => {
  let data: Bootstrap;
  try {
    const res = await fetch(`${BACKEND_URL}/v1/catalog/bootstrap`, {
      // Fresh on every render: the backend keeps the catalogue for 15 s itself, and a stale copy here would hold
      // back the new views and ratings for a whole extra refresh.
      cache: "no-store",
      headers: { "User-Agent": "LunexTeamBFF/1.0 (+server-to-server)", ...(await identityHeaders()) },
    });
    if (!res.ok) return null;
    data = (await res.json()) as Bootstrap;
  } catch {
    return null;
  }
  if (!data.series?.length) return null;

  const genres: Genre[] = data.tags
    .filter((t) => GENRE_GROUPS.has(t.group))
    .map((t) => ({ id: t.slug, slug: t.slug, name: t.name, nameAr: t.nameAr }));

  return {
    genres,
    teams: data.teams,
    users: data.people.map(asUser),
    series: data.series,
    recentChapters: data.recentChapters,
    news: data.news,
    topReaders: data.topReaders.map(asUser),
    stats: data.stats,
  };
});

/** For server components: the real catalogue when there is one, otherwise the built-in sample data. */
export async function loadCatalog(): Promise<Catalog> {
  const seed = await loadCatalogSeed();
  return seed ? seedToCatalog(seed) : mockCatalog();
}
