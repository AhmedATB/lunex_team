import { Suspense } from "react";
import type { Metadata } from "next";
import { getGenres } from "@/lib/mock/repo";
import { SeriesExplorer } from "@/components/explore/series-explorer";

export const metadata: Metadata = {
  title: "استكشاف السلاسل",
  description: "تصفح جميع سلاسل المانهوا والمانها المترجمة على LUNEX TEAM.",
};

export default async function SeriesPage() {
  const genres = await getGenres();
  return (
    <Suspense>
      <SeriesExplorer genres={genres} title="استكشاف السلاسل" />
    </Suspense>
  );
}
