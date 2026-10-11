import type { Chapter as SiteChapter, NewsItem, Series, Team } from "@/lib/types";

/** The catalogue's shapes are the site's own (src/lib/types.ts); only what the app adds or the API sends on top lives here. */
export type { NewsItem, Series, Team };

/** A chapter as /api/catalog sends it: the site's Chapter, plus whether it is a text (novel) chapter. */
export type Chapter = SiteChapter & { hasContent?: boolean };

/** A tag as /api/catalog/bootstrap sends it (genres, themes, formats, content warnings). */
export interface Tag {
  id: string;
  slug: string;
  name: string;
  nameAr: string;
  group: string;
}

/** GET /api/catalog/bootstrap */
export interface Bootstrap {
  tags: Tag[];
  teams: Team[];
  series: Series[];
  recentChapters: Chapter[];
  news: NewsItem[];
}

/** GET /api/catalog/series/:slug */
export interface SeriesDetail {
  series: Series;
  chapters: Chapter[];
  team: Team | null;
}

/** GET /api/auth/me */
export interface SessionUser {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  role: string;
  avatarVersion: string | null;
  bio?: string | null;
  hasPassword?: boolean;
  /** The teams this person works on chapters in (only from /api/auth/me). */
  teamAccess?: { teamId: string; slug: string; name: string; level: "lead" | "publisher" | "uploader" }[];
}

export type { LockRule } from "@/lib/chapter-lock";
