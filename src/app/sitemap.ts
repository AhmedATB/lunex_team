import type { MetadataRoute } from "next";
import { loadCatalog } from "@/lib/catalog-server";
import { SITE_URL as BASE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = await loadCatalog();

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
    url: `${BASE_URL}/series/${encodeURIComponent(s.slug)}`,
    lastModified: s.updatedAt,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const teamRoutes: MetadataRoute.Sitemap = db.teams.map((t) => ({
    url: `${BASE_URL}/teams/${encodeURIComponent(t.slug)}`,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...seriesRoutes, ...teamRoutes];
}
