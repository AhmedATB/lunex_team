import type { MetadataRoute } from "next";
import { loadCatalog, loadSitemapIndex } from "@/lib/catalog-server";
import { chapterPath, seriesPath, teamPath } from "@/lib/seo";
import { SITE_URL as BASE_URL } from "@/lib/site";

/** Every page worth finding: the lists, each work, each of its published chapters, and each team. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [db, index] = await Promise.all([loadCatalog(), loadSitemapIndex()]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE_URL}/series`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/search`, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE_URL}/teams`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE_URL}/news`, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const seriesRoutes: MetadataRoute.Sitemap = db.series.map((s) => ({
    url: `${BASE_URL}${seriesPath(s.slug)}`,
    lastModified: s.updatedAt,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  // The chapters come from the backend's own index (the catalogue only carries the latest ones). Without it the sitemap is still valid, just shorter.
  const chapterRoutes: MetadataRoute.Sitemap = (index ?? []).flatMap((s) =>
    s.chapters.map((c) => ({
      url: `${BASE_URL}${chapterPath(s.slug, c.number)}`,
      lastModified: c.at,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }))
  );

  const teamRoutes: MetadataRoute.Sitemap = db.teams.map((t) => ({
    url: `${BASE_URL}${teamPath(t.slug)}`,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...seriesRoutes, ...chapterRoutes, ...teamRoutes];
}
