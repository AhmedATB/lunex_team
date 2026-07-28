import { getMockDatabase } from "./generate";
import type { Series, Chapter, Genre, Team, User, Comment, NewsItem } from "../types";

/**
 * Data-access layer. Every function is async and returns plain data so the
 * mock in-memory implementation can be swapped for Prisma/Postgres later
 * without touching call sites.
 */

function db() {
  return getMockDatabase();
}

export async function getGenres(): Promise<Genre[]> {
  return db().genres;
}

export async function getTeams(): Promise<Team[]> {
  return db().teams;
}

export async function getTeamBySlug(slug: string): Promise<Team | undefined> {
  return db().teams.find((t) => t.slug === slug);
}

export async function getUserById(id: string): Promise<User | undefined> {
  return db().users.find((u) => u.id === id);
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  return db().users.find((u) => u.username === username);
}

export async function getTopReaders(limit = 10): Promise<User[]> {
  return [...db().users].sort((a, b) => b.readCount - a.readCount).slice(0, limit);
}

export interface SeriesFilters {
  genre?: string;
  status?: Series["status"];
  country?: Series["country"];
  type?: Series["type"];
  year?: number;
  query?: string;
  sort?: "popular" | "latest" | "rating" | "az" | "views";
  page?: number;
  pageSize?: number;
}

export async function getSeriesList(filters: SeriesFilters = {}): Promise<{ items: Series[]; total: number }> {
  let items = [...db().series];

  if (filters.genre) items = items.filter((s) => s.genreIds.includes(filters.genre!));
  if (filters.status) items = items.filter((s) => s.status === filters.status);
  if (filters.country) items = items.filter((s) => s.country === filters.country);
  if (filters.type) items = items.filter((s) => s.type === filters.type);
  if (filters.year) items = items.filter((s) => s.year === filters.year);
  if (filters.query) {
    const q = filters.query.toLowerCase();
    items = items.filter(
      (s) => s.titleAr.toLowerCase().includes(q) || s.title.toLowerCase().includes(q)
    );
  }

  switch (filters.sort) {
    case "rating":
      items.sort((a, b) => b.rating - a.rating);
      break;
    case "az":
      items.sort((a, b) => a.titleAr.localeCompare(b.titleAr, "ar"));
      break;
    case "views":
      items.sort((a, b) => b.views - a.views);
      break;
    case "latest":
      items.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
      break;
    default:
      items.sort((a, b) => b.bookmarks - a.bookmarks);
  }

  const total = items.length;
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 24;
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total };
}

export async function getSeriesBySlug(slug: string): Promise<Series | undefined> {
  return db().series.find((s) => s.slug === slug);
}

export async function getSeriesById(id: string): Promise<Series | undefined> {
  return db().series.find((s) => s.id === id);
}

export async function getChaptersBySeries(seriesId: string): Promise<Chapter[]> {
  return db()
    .chapters.filter((c) => c.seriesId === seriesId)
    .sort((a, b) => b.number - a.number);
}

export async function getChapter(seriesId: string, number: number): Promise<Chapter | undefined> {
  return db().chapters.find((c) => c.seriesId === seriesId && c.number === number);
}

export async function getLatestChapters(limit = 18): Promise<(Chapter & { series: Series })[]> {
  const { chapters, series } = db();
  const seriesMap = new Map(series.map((s) => [s.id, s]));
  return [...chapters]
    .sort((a, b) => +new Date(b.releasedAt) - +new Date(a.releasedAt))
    .slice(0, limit)
    .map((c) => ({ ...c, series: seriesMap.get(c.seriesId)! }))
    .filter((c) => c.series);
}

export async function getTrendingSeries(limit = 10): Promise<Series[]> {
  return [...db().series].sort((a, b) => b.views - a.views).slice(0, limit);
}

export async function getPopularToday(limit = 10): Promise<Series[]> {
  const rng = [...db().series];
  return rng.sort((a, b) => b.likes - a.likes).slice(0, limit);
}

export async function getRecentlyUpdated(limit = 12): Promise<Series[]> {
  return [...db().series]
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .slice(0, limit);
}

export async function getNewReleases(limit = 12): Promise<Series[]> {
  return [...db().series].sort((a, b) => b.year - a.year).slice(0, limit);
}

export async function getCompletedSeries(limit = 12): Promise<Series[]> {
  return db().series.filter((s) => s.status === "completed").slice(0, limit);
}

export async function getOngoingSeries(limit = 12): Promise<Series[]> {
  return db().series.filter((s) => s.status === "ongoing").slice(0, limit);
}

export async function getRecommendedSeries(limit = 12): Promise<Series[]> {
  return db().series.filter((s) => s.isRecommended).slice(0, limit);
}

export async function getFeaturedSeries(limit = 6): Promise<Series[]> {
  return db().series.filter((s) => s.isFeatured).slice(0, limit);
}

export async function getRandomPick(): Promise<Series> {
  const { series } = db();
  const idx = Math.floor((Date.now() / 86_400_000) % series.length);
  return series[idx];
}

export async function getCommentsForSeries(seriesId: string): Promise<Comment[]> {
  return db()
    .comments.filter((c) => c.seriesId === seriesId)
    .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || b.likes - a.likes);
}

export async function getNews(limit = 6): Promise<NewsItem[]> {
  return [...db().news]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, limit);
}

export async function getPlatformStats() {
  const { series, chapters, users, comments } = db();
  return {
    totalSeries: series.length,
    totalChapters: chapters.length,
    totalUsers: users.length,
    totalComments: comments.length,
    totalViews: series.reduce((s, x) => s + x.views, 0),
  };
}

export async function getKanbanTasksForTeam(teamId: string) {
  return db().kanbanTasks.filter((t) => t.teamId === teamId);
}

export async function getSeriesForTeam(teamId: string) {
  return db().series.filter((s) => s.teamId === teamId);
}
