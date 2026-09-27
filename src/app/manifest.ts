import type { MetadataRoute } from "next";

/**
 * Lets a phone install the site to its home screen (Chrome's "Add to Home screen", Safari's "Add to Home Screen"): its own icon and
 * name, opening full-screen without the browser's bars, and shortcuts to the places readers go. The colours are the site's dark ground.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LUNEX TEAM — منصة قراءة المانهوا المترجمة",
    short_name: "LUNEX",
    description: "منصة عربية لقراءة المانهوا والمانجا والمانها المترجمة.",
    id: "/",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "ar",
    dir: "rtl",
    background_color: "#09090B",
    theme_color: "#09090B",
    categories: ["entertainment", "books"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "استكشاف الأعمال", short_name: "استكشاف", url: "/series" },
      { name: "مفضلتي", short_name: "مفضلتي", url: "/bookmarks" },
      { name: "البحث", short_name: "بحث", url: "/search" },
    ],
  };
}
