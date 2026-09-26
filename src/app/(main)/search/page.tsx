import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getGenres } from "@/lib/mock/repo";
import { UnifiedSearch } from "@/components/search/unified-search";

export const metadata: Metadata = {
  title: "البحث",
  description: "ابحث عن سلاسل، فرق ترجمة، أو مستخدمين في مكان واحد.",
};

/** Links such as "show all" and the category tiles filter the catalogue without a search word; that is the browse page's job. */
const FILTERS = ["genre", "status", "type", "country", "sort"] as const;

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const word = typeof params.q === "string" ? params.q.trim() : "";
  if (!word) {
    const carried = new URLSearchParams();
    for (const key of FILTERS) {
      const value = params[key];
      if (typeof value === "string" && value) carried.set(key, value);
    }
    if (carried.size > 0) redirect(`/series?${carried}`);
  }

  const genres = await getGenres();
  return (
    <Suspense>
      <UnifiedSearch genres={genres} />
    </Suspense>
  );
}
