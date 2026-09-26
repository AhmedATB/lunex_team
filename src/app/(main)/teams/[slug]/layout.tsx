import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/seo/json-ld";
import { loadCatalog } from "@/lib/catalog-server";
import { SITE_NAME, absoluteUrl, breadcrumbJsonLd, clip, teamJsonLd, teamPath } from "@/lib/seo";
import { safeDecodeURIComponent } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

async function findTeam(slugParam: string) {
  const db = await loadCatalog();
  const slug = safeDecodeURIComponent(slugParam);
  return db.teams.find((t) => t.slug === slug);
}

/** A team's own title, description and logo for search results and link previews. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const team = await findTeam((await params).slug);
  if (!team) return { robots: { index: false, follow: false } };
  const title = `${team.name} — فريق ترجمة`;
  const description = clip(team.description ? `${team.name}: ${team.description}` : `فريق ${team.name} على ${SITE_NAME}: أعماله المترجمة وأعضاؤه وباب التوظيف.`, 200);
  // A team with no logo yet shows the site's own banner in a link preview, not nothing.
  const images = team.logoUrl ? [{ url: absoluteUrl(team.logoUrl), alt: team.name }] : [{ url: absoluteUrl("/og-banner.jpg"), width: 1200, height: 630, alt: SITE_NAME }];
  return {
    title,
    description,
    alternates: { canonical: teamPath(team.slug) },
    openGraph: { type: "website", siteName: SITE_NAME, locale: "ar_AR", url: teamPath(team.slug), title, description, images },
    twitter: { card: "summary", title, description, images: images.map((i) => i.url) },
  };
}

export default async function TeamLayout({ children, params }: Props & { children: ReactNode }) {
  const team = await findTeam((await params).slug);
  if (!team) return children;
  return (
    <>
      {children}
      <JsonLd data={teamJsonLd(team)} />
      <JsonLd data={breadcrumbJsonLd([{ name: SITE_NAME, path: "/" }, { name: "الفرق", path: "/teams" }, { name: team.name, path: teamPath(team.slug) }])} />
    </>
  );
}
