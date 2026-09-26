import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Pages that need an account (a crawler would only be sent to the sign-in page) and the chapter reader.
        disallow: ["/admin", "/api", "/messages", "/store", "/profile", "/bookmarks", "/teams/create", "/series/*/*", "/login", "/register", "/forgot-password"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
