import { loadCatalog } from "../catalog-server";
import { byFollowers, byPopularity, byThisWeek, byTopRated, byViews } from "../ranking";
import { prepareSearchQuery, searchTier, seriesSearchFields } from "../fuzzy-search";
import { latestPerSeries } from "../latest-chapters";
import type { Series, Chapter, Genre, Team, User, Comment, NewsItem } from "../types";

/**
 * Data-access layer for server components: every function is async and reads
 * the catalogue (the database, or the built-in sample data while it is empty).
 */

async function db() {
  return loadCatalog();
}

export async function getGenres(): Promise<Genre[]> {
  return (await db()).genres;
}

export async function getTeams(): Promise<Team[]> {
  return (await db()).teams;
}

export async function getTeamBySlug(slug: string): Promise<Team | undefined> {
  return (await db()).teams.find((t) => t.slug === slug);
}

export async function getUserById(id: string): Promise<User | undefined> {
  return (await db()).users.find((u) => u.id === id);
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  return (await db()).users.find((u) => u.username === username);
}

export async function getTopReaders(limit = 10): Promise<User[]> {
  return (await db()).topReaders.slice(0, limit);
}

export interface SeriesFilters {
  genre?: string;
  status?: Series["status"];
  country?: Series["country"];
  type?: Series["type"];
  year?: number;
  query?: string;
  sort?: "popular" | "trending" | "followers" | "latest" | "rating" | "az" | "views";
  page?: number;
  pageSize?: number;
}

export async function getSeriesList(filters: SeriesFilters = {}): Promise<{ items: Series[]; total: number }> {
  let items = [...(await db()).series];

  if (filters.genre) items = items.filter((s) => s.genreIds.includes(filters.genre!));
  if (filters.status) items = items.filter((s) => s.status === filters.status);
  if (filters.country) items = items.filter((s) => s.country === filters.country);
  if (filters.type) items = items.filter((s) => s.type === filters.type);
  if (filters.year) items = items.filter((s) => s.year === filters.year);
  if (filters.query) {
    const q = prepareSearchQuery(filters.query);
    items = items.filter((s) => searchTier(q, seriesSearchFields(s)) > 0);
  }

  switch (filters.sort) {
    case "rating":
      items.sort(byTopRated);
      break;
    case "az":
      items.sort((a, b) => a.titleAr.localeCompare(b.titleAr, "ar"));
      break;
    case "views":
      items.sort(byViews);
      break;
    case "trending":
      items.sort(byThisWeek);
      break;
    case "followers":
      items.sort(byFollowers);
      break;
    case "latest":
      items.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
      break;
    default:
      items.sort(byPopularity);
  }

  const total = items.length;
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 24;
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total };
}

export async function getSeriesBySlug(slug: string): Promise<Series | undefined> {
  return (await db()).series.find((s) => s.slug === slug);
}

export async function getSeriesById(id: string): Promise<Series | undefined> {
  return (await db()).series.find((s) => s.id === id);
}

export async function getChaptersBySeries(seriesId: string): Promise<Chapter[]> {
  return (await db())
    .chapters.filter((c) => c.seriesId === seriesId)
    .sort((a, b) => b.number - a.number);
}

export async function getChapter(seriesId: string, number: number): Promise<Chapter | undefined> {
  return (await db()).chapters.find((c) => c.seriesId === seriesId && c.number === number);
}

/** The newest chapter of each of the most recently updated series — one entry per work, however many chapters it just released. */
export async function getLatestChapters(limit = 18): Promise<(Chapter & { series: Series; moreCount: number })[]> {
  const { recentChapters, series } = await db();
  const seriesMap = new Map(series.map((s) => [s.id, s]));
  return latestPerSeries(
    recentChapters.filter((c) => seriesMap.has(c.seriesId)),
    limit
  ).map((c) => ({ ...c, series: seriesMap.get(c.seriesId)! }));
}

export async function getTrendingSeries(limit = 10): Promise<Series[]> {
  return [...(await db()).series].sort(byThisWeek).slice(0, limit);
}

export async function getPopularToday(limit = 10): Promise<Series[]> {
  return [...(await db()).series].sort(byPopularity).slice(0, limit);
}

export async function getRecentlyUpdated(limit = 12): Promise<Series[]> {
  return [...(await db()).series]
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .slice(0, limit);
}

export async function getNewReleases(limit = 12): Promise<Series[]> {
  return [...(await db()).series].sort((a, b) => b.year - a.year).slice(0, limit);
}

export async function getCompletedSeries(limit = 12): Promise<Series[]> {
  return (await db()).series.filter((s) => s.status === "completed").sort(byPopularity).slice(0, limit);
}

export async function getOngoingSeries(limit = 12): Promise<Series[]> {
  return (await db()).series.filter((s) => s.status === "ongoing").sort(byPopularity).slice(0, limit);
}

export async function getRecommendedSeries(limit = 12): Promise<Series[]> {
  return (await db()).series.filter((s) => s.isRecommended).sort(byPopularity).slice(0, limit);
}

export async function getFeaturedSeries(limit = 6): Promise<Series[]> {
  // The owner pins works in a chosen order (featuredOrder); a pinned work without one goes after them, most popular first.
  return (await db()).series
    .filter((s) => s.isFeatured)
    .sort((a, b) => (a.featuredOrder ?? Number.MAX_SAFE_INTEGER) - (b.featuredOrder ?? Number.MAX_SAFE_INTEGER) || byPopularity(a, b))
    .slice(0, limit);
}

export async function getRandomPick(): Promise<Series> {
  const { series } = await db();
  const idx = Math.floor((Date.now() / 86_400_000) % series.length);
  return series[idx];
}

export async function getCommentsForSeries(seriesId: string): Promise<Comment[]> {
  return (await db())
    .comments.filter((c) => c.seriesId === seriesId)
    .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || b.likes - a.likes);
}

export async function getNews(limit = 6): Promise<NewsItem[]> {
  return [...(await db()).news]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, limit);
}

export async function getPlatformStats() {
  const { series, stats } = await db();
  return {
    totalSeries: series.length,
    totalChapters: stats.chapters,
    totalUsers: stats.members,
    totalComments: stats.comments,
    totalViews: series.reduce((s, x) => s + x.views, 0),
  };
}

export async function getKanbanTasksForTeam(teamId: string) {
  return (await db()).kanbanTasks.filter((t) => t.teamId === teamId);
}

export async function getSeriesForTeam(teamId: string) {
  return (await db()).series.filter((s) => s.teamId === teamId);
}
