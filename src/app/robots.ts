import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          // The pictures link previews and image search use (covers, banners, team logos, news covers). Longer rules beat the /api one below.
          "/api/catalog/series/*/cover",
          "/api/catalog/series/*/banner",
          "/api/catalog/teams/*/logo",
          "/api/catalog/news/*/cover",
        ],
        // Pages that need an account (a crawler would only be sent to the sign-in page), and the site's own data routes.
        // The chapter pages (/series/<work>/<number>) are open to search engines on purpose: their images stay behind tokens.
        disallow: ["/admin", "/api", "/messages", "/store", "/profile", "/bookmarks", "/teams/create", "/teams/*/dashboard", "/login", "/register", "/forgot-password", "/reset-password"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
