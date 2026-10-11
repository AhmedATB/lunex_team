/** The shapes the site's `/api/catalog` answers with — a subset of the web app's lib/types.ts, only what the app reads. */

export type SeriesType = "manhwa" | "manga" | "manhua" | "novel" | string;
export type SeriesStatus = "ongoing" | "completed" | "hiatus" | "cancelled" | string;

export interface Series {
  id: string;
  slug: string;
  title: string;
  titleAr: string;
  alternativeTitles: string[];
  cover: string;
  banner: string;
  synopsis: string;
  type: SeriesType;
  status: SeriesStatus;
  country: "kr" | "jp" | "cn" | string;
  author: string;
  artist: string;
  year: number;
  rating: number;
  ratingCount: number;
  views: number;
  viewsWeek?: number;
  bookmarks: number;
  likes: number;
  collaboratorTeamIds?: string[];
  contentRating?: string;
  genreIds: string[];
  tags: string[];
  teamId: string;
  chapterCount: number;
  latestChapterNumber: number;
  updatedAt: string;
  isFeatured: boolean;
  featuredOrder?: number | null;
  isRecommended: boolean;
}

export interface Chapter {
  id: string;
  seriesId: string;
  number: number;
  title: string;
  pages: number;
  hasContent?: boolean;
  releasedAt: string;
  views: number;
  manualLock?: boolean | null;
  teamId: string;
  thumbnail?: string;
}

export interface Team {
  id: string;
  slug: string;
  name: string;
  color: string;
  logoUrl?: string;
  description?: string;
  recruiting?: boolean;
  status?: string;
  memberIds?: string[];
  rank?: number;
  discordUrl?: string;
  category?: string;
}

export interface Tag {
  id: string;
  slug: string;
  name: string;
  nameAr: string;
  group: string;
}

export interface NewsItem {
  id: string;
  title: string;
  cover: string;
  category: "announcement" | "event" | "news" | string;
  createdAt: string;
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
}

/** GET /api/wallet/rule — which chapters show as locked (the server is what actually refuses them). */
export interface LockRule {
  lockedWindow: number;
  freeFirstChapters: number;
}
