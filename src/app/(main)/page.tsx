import {
  getFeaturedSeries,
  getLatestChapters,
  getPopularToday,
  getTrendingSeries,
  getRecentlyUpdated,
  getNewReleases,
  getCompletedSeries,
  getOngoingSeries,
  getRecommendedSeries,
  getGenres,
  getRandomPick,
  getNews,
  getTopReaders,
  getPlatformStats,
} from "@/lib/mock/repo";
import { getMockDatabase } from "@/lib/mock/generate";
import { HomeLayoutSwitcher } from "@/components/home/layouts/home-layout-switcher";

export default async function HomePage() {
  const [
    featured,
    latestChapters,
    popular,
    trending,
    recentlyUpdated,
    newReleases,
    completed,
    ongoing,
    recommended,
    genres,
    randomPick,
    news,
    topReaders,
    stats,
  ] = await Promise.all([
    getFeaturedSeries(6),
    getLatestChapters(12),
    getPopularToday(6),
    getTrendingSeries(10),
    getRecentlyUpdated(12),
    getNewReleases(12),
    getCompletedSeries(6),
    getOngoingSeries(12),
    getRecommendedSeries(6),
    getGenres(),
    getRandomPick(),
    getNews(6),
    getTopReaders(8),
    getPlatformStats(),
  ]);

  const db = getMockDatabase();
  const latestComments = [...db.comments]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 6);
  const seriesMap = new Map(db.series.map((s) => [s.id, s]));

  return (
    <HomeLayoutSwitcher
      featured={featured}
      latestChapters={latestChapters}
      popular={popular}
      trending={trending}
      recentlyUpdated={recentlyUpdated}
      newReleases={newReleases}
      completed={completed}
      ongoing={ongoing}
      recommended={recommended}
      genres={genres}
      randomPick={randomPick}
      news={news}
      topReaders={topReaders}
      stats={stats}
      latestComments={latestComments}
      users={db.users}
      seriesMap={seriesMap}
    />
  );
}
