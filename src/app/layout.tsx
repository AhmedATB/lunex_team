import type { Metadata } from "next";
import { Cairo, Tajawal } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StoreHydration } from "@/components/store-hydration";

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

export const metadata: Metadata = {
  metadataBase: new URL("https://lunexteam.example"),
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
  },
  twitter: {
    card: "summary_large_image",
    title: "LUNEX TEAM",
    description: "منصة عربية فاخرة لقراءة وترجمة المانهوا والمانها.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${tajawal.variable}`} suppressHydrationWarning>
      <body className="font-sans">
        <StoreHydration />
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
