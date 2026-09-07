import { Suspense } from "react";
import type { Metadata } from "next";
import { getGenres } from "@/lib/mock/repo";
import { UnifiedSearch } from "@/components/search/unified-search";

export const metadata: Metadata = {
  title: "البحث",
  description: "ابحث عن سلاسل، فرق ترجمة، أو مستخدمين في مكان واحد.",
};

export default async function SearchPage() {
  const genres = await getGenres();
  return (
    <Suspense>
      <UnifiedSearch genres={genres} />
    </Suspense>
  );
}
