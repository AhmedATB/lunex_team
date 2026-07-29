"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownUp, Eye, Search } from "lucide-react";
import type { Chapter } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { timeAgo, formatNumber } from "@/lib/utils";
import { useReadingProgress } from "@/store/reader-settings";

export function ChapterList({ seriesSlug, chapters }: { seriesSlug: string; chapters: Chapter[] }) {
  const [query, setQuery] = useState("");
  const [asc, setAsc] = useState(false);
  const seriesId = chapters[0]?.seriesId;
  const lastRead = useReadingProgress((s) => (seriesId ? s.getProgress(seriesId) : undefined));

  const list = useMemo(() => {
    let items = chapters.filter((c) => c.number.toString().includes(query) || c.title.includes(query));
    items = [...items].sort((a, b) => (asc ? a.number - b.number : b.number - a.number));
    return items;
  }, [chapters, query, asc]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن رقم الفصل..."
            className="ps-9"
          />
        </div>
        <Button variant="secondary" size="icon" onClick={() => setAsc((v) => !v)} aria-label="ترتيب">
          <ArrowDownUp className="h-4 w-4" />
        </Button>
      </div>

      <div className="panel max-h-[560px] overflow-y-auto">
        {list.map((c) => (
          <Link
            key={c.id}
            href={`/series/${seriesSlug}/${c.number}`}
            className="group relative flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3 text-sm transition-colors last:border-0 hover:bg-primary-600/10 active:bg-primary-600/10"
          >
            <span className="absolute inset-y-0 start-0 w-0.5 scale-y-0 bg-lunex-gradient transition-transform duration-300 group-hover:scale-y-100 group-active:scale-y-100" />
            <div className="min-w-0">
              <p className="truncate font-medium text-white">
                {c.title}
                {lastRead === c.number && (
                  <span className="ms-2 rounded-full bg-primary-500/20 px-2 py-0.5 text-[10px] text-primary-300 shadow-[0_0_10px_rgba(168,85,247,0.4)]">
                    آخر قراءة
                  </span>
                )}
              </p>
              <p className="text-xs text-lunex-gray">{timeAgo(c.releasedAt)}</p>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-xs text-lunex-gray transition-colors group-hover:text-primary-300 group-active:text-primary-300">
              <Eye className="h-3.5 w-3.5" /> {formatNumber(c.views)}
            </span>
          </Link>
        ))}
        {list.length === 0 && (
          <p className="p-6 text-center text-sm text-lunex-gray">لا توجد فصول مطابقة.</p>
        )}
      </div>
    </div>
  );
}
