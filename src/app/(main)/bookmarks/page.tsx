"use client";

import { useEffect, useMemo } from "react";
import { Bookmark } from "lucide-react";
import { useBookmarks } from "@/store/reader-settings";
import { getMockDatabase } from "@/lib/mock/generate";
import { SeriesCard } from "@/components/shared/series-card";

export default function BookmarksPage() {
  useEffect(() => {
    document.title = "مفضلتي | LUNEX TEAM";
  }, []);
  const bookmarkIds = useBookmarks((s) => s.bookmarks);
  const allSeries = useMemo(() => getMockDatabase().series, []);
  const bookmarked = useMemo(
    () => allSeries.filter((s) => bookmarkIds.includes(s.id)),
    [allSeries, bookmarkIds]
  );

  return (
    <div className="container space-y-6 py-6">
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-white sm:text-3xl">
        <Bookmark className="h-6 w-6 text-primary-300" /> مفضلتي
      </h1>

      {bookmarked.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center">
          <Bookmark className="mx-auto mb-3 h-10 w-10 text-lunex-gray" />
          <p className="text-lunex-gray">لم تضف أي سلسلة إلى المفضلة بعد.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {bookmarked.map((s) => (
            <SeriesCard key={s.id} series={s} />
          ))}
        </div>
      )}
    </div>
  );
}
