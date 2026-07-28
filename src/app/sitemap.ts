import type { MetadataRoute } from "next";
import { getMockDatabase } from "@/lib/mock/generate";

const BASE_URL = "https://lunexteam.example";

export default function sitemap(): MetadataRoute.Sitemap {
  const db = getMockDatabase();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE_URL}/series`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/search`, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE_URL}/teams`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE_URL}/news`, changeFrequency: "daily", priority: 0.6 },
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
