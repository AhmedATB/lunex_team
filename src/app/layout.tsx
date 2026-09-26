import { Suspense } from "react";
import type { Metadata } from "next";
import { Cairo, Tajawal, Baloo_Bhaijaan_2 } from "next/font/google";
import "./globals.css";
import { NavigationProgress } from "@/components/navigation-progress";
import { CookieConsent } from "@/components/consent/cookie-consent";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StoreHydration } from "@/components/store-hydration";
import { LibrarySync } from "@/components/library-sync";
import { CatalogProvider } from "@/components/catalog-provider";
import { SessionHint } from "@/components/session-hint";
import { loadCatalogSeed } from "@/lib/catalog-server";
import { ThemeApplier } from "@/components/theme-applier";
import { getServerSession } from "@/lib/server-session";
import { getInitialStyle } from "@/lib/theme-cookie";
import { getInitialConsent } from "@/lib/consent-cookie";
import { AdScripts } from "@/components/ads/ad-scripts";
import { SITE_URL } from "@/lib/site";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  weight: ["500", "600", "700", "800", "900"],
});

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  variable: "--font-tajawal",
  weight: ["400", "500", "700"],
});

const baloo = Baloo_Bhaijaan_2({
  subsets: ["arabic", "latin"],
  variable: "--font-baloo",
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "LUNEX TEAM — منصة قراءة المانهوا المترجمة",
    template: "%s | LUNEX TEAM",
  },
  description:
    "LUNEX TEAM: منصة عربية فاخرة لقراءة وترجمة المانهوا والمانها بجودة عالية، حصريات أسبوعية وفريق ترجمة احترافي.",
  openGraph: {
    title: "LUNEX TEAM",
    description: "منصة عربية فاخرة لقراءة وترجمة المانهوا والمانها.",
    siteName: "LUNEX TEAM",
    locale: "ar_AR",
    type: "website",
    // 1200x630 (about 1.91:1) is what link previews on Discord, Telegram, WhatsApp and X show without cropping; ~60 KB.
    images: [{ url: "/og-banner.jpg", width: 1200, height: 630, alt: "LUNEX TEAM — منصتك الفاخرة لعالم المانهوا والمانها", type: "image/jpeg" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LUNEX TEAM",
    description: "منصة عربية فاخرة لقراءة وترجمة المانهوا والمانها.",
    images: ["/og-banner.jpg"],
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [initialUser, initialStyle, initialConsent, catalogSeed] = await Promise.all([
    getServerSession(),
    getInitialStyle(),
    getInitialConsent(),
    loadCatalogSeed(),
  ]);

  return (
    <html
      lang="ar"
      dir="rtl"
      data-style={initialStyle}
      className={`${cairo.variable} ${tajawal.variable} ${baloo.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans">
        <StoreHydration initialUser={initialUser} />
        <LibrarySync userId={initialUser?.id ?? null} />
        <ThemeApplier />
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <SessionHint userId={initialUser?.id ?? null}>
          <CatalogProvider seed={catalogSeed}>
            <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          </CatalogProvider>
        </SessionHint>
        <CookieConsent initialChoice={initialConsent} />
        <AdScripts />
      </body>
    </html>
  );
}
