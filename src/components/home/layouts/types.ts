import type {
  getFeaturedSeries,
  getLatestChapters,
  getGenres,
  getRandomPick,
  getNews,
  getTopReaders,
  getPlatformStats,
} from "@/lib/mock/repo";
import type { Comment, Series, User } from "@/lib/types";

/** Shared data contract every home layout variant receives — derived from the repo functions' own return types so this can't drift out of sync with page.tsx's fetch. */
export interface HomeLayoutData {
  featured: Awaited<ReturnType<typeof getFeaturedSeries>>;
  latestChapters: Awaited<ReturnType<typeof getLatestChapters>>;
  popular: Series[];
  trending: Series[];
  recentlyUpdated: Series[];
  newReleases: Series[];
  completed: Series[];
  ongoing: Series[];
  recommended: Series[];
  genres: Awaited<ReturnType<typeof getGenres>>;
  randomPick: Awaited<ReturnType<typeof getRandomPick>>;
  news: Awaited<ReturnType<typeof getNews>>;
  topReaders: Awaited<ReturnType<typeof getTopReaders>>;
  stats: Awaited<ReturnType<typeof getPlatformStats>>;
  latestComments: Comment[];
  users: User[];
  seriesMap: Map<string, Series>;
}
