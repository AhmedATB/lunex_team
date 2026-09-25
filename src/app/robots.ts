import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, SITE_REQUIRES_LOGIN } from "@/lib/access-policy";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: SITE_REQUIRES_LOGIN
      ? [{ userAgent: "*", allow: [...PUBLIC_PAGES], disallow: "/" }]
      : [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
