import { Suspense } from "react";
import type { Metadata } from "next";
import { getGenres } from "@/lib/mock/repo";
import { SeriesExplorer } from "@/components/explore/series-explorer";

export const metadata: Metadata = {
  title: "البحث",
  description: "ابحث عن سلسلتك المفضلة بالاسم أو المؤلف أو التصنيف.",
};

export default async function SearchPage() {
  const genres = await getGenres();
  return (
    <Suspense>
      <SeriesExplorer genres={genres} title="البحث" />
    </Suspense>
  );
}
