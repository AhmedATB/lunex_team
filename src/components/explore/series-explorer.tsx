"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search as SearchIcon, SlidersHorizontal, X } from "lucide-react";
import type { Genre, Series } from "@/lib/types";
import { getMockDatabase } from "@/lib/mock/generate";
import { useTeamManagement } from "@/store/team-management";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SeriesCard, SeriesCardSkeleton } from "@/components/shared/series-card";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: { value: Series["status"]; label: string }[] = [
  { value: "ongoing", label: "مستمر" },
  { value: "completed", label: "مكتمل" },
  { value: "hiatus", label: "متوقف مؤقتاً" },
  { value: "dropped", label: "متروك" },
];

const TYPE_OPTIONS: { value: Series["type"]; label: string }[] = [
  { value: "manhwa", label: "مانهوا" },
  { value: "manga", label: "مانجا" },
  { value: "manhua", label: "مانها" },
  { value: "novel", label: "رواية" },
];

const COUNTRY_OPTIONS: { value: Series["country"]; label: string }[] = [
  { value: "kr", label: "كوريا" },
  { value: "jp", label: "اليابان" },
  { value: "cn", label: "الصين" },
];

const SORT_OPTIONS = [
  { value: "popular", label: "الأكثر متابعة" },
  { value: "views", label: "الأكثر مشاهدة" },
  { value: "latest", label: "آخر تحديث" },
  { value: "rating", label: "الأعلى تقييماً" },
  { value: "az", label: "أبجدياً" },
] as const;

interface Filters {
  q: string;
  genre?: string;
  status?: Series["status"];
  type?: Series["type"];
  country?: Series["country"];
  sort: (typeof SORT_OPTIONS)[number]["value"];
}

export function SeriesExplorer({ genres, title }: { genres: Genre[]; title: string }) {
  const searchParams = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 24;

  const [filters, setFilters] = useState<Filters>({
    q: searchParams.get("q") ?? "",
    genre: searchParams.get("genre") ?? undefined,
    status: (searchParams.get("status") as Series["status"]) ?? undefined,
    type: (searchParams.get("type") as Series["type"]) ?? undefined,
    country: (searchParams.get("country") as Series["country"]) ?? undefined,
    sort: (searchParams.get("sort") as Filters["sort"]) ?? "popular",
  });

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 250);
    return () => clearTimeout(t);
  }, [filters, page]);

  useEffect(() => setPage(1), [filters]);

  const db = useMemo(() => getMockDatabase(), []);
  const addedSeries = useTeamManagement((s) => s.addedSeries);
  const seriesInfoOverrides = useTeamManagement((s) => s.seriesInfoOverrides);
  const removedSeriesIds = useTeamManagement((s) => s.removedSeriesIds);

  const allSeries = useMemo(() => {
    const removed = new Set(removedSeriesIds);
    return [...db.series, ...addedSeries]
      .filter((s) => !removed.has(s.id))
      .map((s) => ({ ...s, ...seriesInfoOverrides[s.id] }));
  }, [db, addedSeries, seriesInfoOverrides, removedSeriesIds]);

  const filtered = useMemo(() => {
    let items = [...allSeries];
    if (filters.q) {
      const q = filters.q.toLowerCase();
      items = items.filter(
        (s) =>
          s.titleAr.toLowerCase().includes(q) ||
          s.title.toLowerCase().includes(q) ||
          s.author.toLowerCase().includes(q)
      );
    }
    if (filters.genre) items = items.filter((s) => s.genreIds.includes(filters.genre!));
    if (filters.status) items = items.filter((s) => s.status === filters.status);
    if (filters.type) items = items.filter((s) => s.type === filters.type);
    if (filters.country) items = items.filter((s) => s.country === filters.country);

    switch (filters.sort) {
      case "views":
        items.sort((a, b) => b.views - a.views);
        break;
      case "latest":
        items.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
        break;
      case "rating":
        items.sort((a, b) => b.rating - a.rating);
        break;
      case "az":
        items.sort((a, b) => a.titleAr.localeCompare(b.titleAr, "ar"));
        break;
      default:
        items.sort((a, b) => b.bookmarks - a.bookmarks);
    }
    return items;
  }, [allSeries, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function clearAll() {
    setFilters({ q: "", sort: "popular" });
  }

  const activeCount = [filters.genre, filters.status, filters.type, filters.country].filter(Boolean).length;

  return (
    <div className="container space-y-6 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">{title}</h1>
        <div className="relative w-full sm:w-80">
          <SearchIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
          <Input
            value={filters.q}
            onChange={(e) => update("q", e.target.value)}
            placeholder="ابحث بالاسم أو المؤلف..."
            className="ps-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowFilters((v) => !v)}
          className="lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" /> الفلاتر {activeCount > 0 && `(${activeCount})`}
        </Button>

        <div className={cn("flex flex-1 flex-wrap items-center gap-2", !showFilters && "hidden lg:flex")}>
          <Select value={filters.status ?? "all"} onValueChange={(v) => update("status", v === "all" ? undefined : (v as Series["status"]))}>
            <SelectTrigger className="w-36"><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filters.type ?? "all"} onValueChange={(v) => update("type", v === "all" ? undefined : (v as Series["type"]))}>
            <SelectTrigger className="w-32"><SelectValue placeholder="النوع" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأنواع</SelectItem>
              {TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filters.country ?? "all"} onValueChange={(v) => update("country", v === "all" ? undefined : (v as Series["country"]))}>
            <SelectTrigger className="w-32"><SelectValue placeholder="البلد" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الدول</SelectItem>
              {COUNTRY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filters.genre ?? "all"} onValueChange={(v) => update("genre", v === "all" ? undefined : v)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="التصنيف" /></SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="all">كل التصنيفات</SelectItem>
              {genres.map((g) => <SelectItem key={g.id} value={g.id}>{g.nameAr}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filters.sort} onValueChange={(v) => update("sort", v as Filters["sort"])}>
            <SelectTrigger className="w-40"><SelectValue placeholder="الترتيب" /></SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {(activeCount > 0 || filters.q) && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="text-red-400">
              <X className="h-3.5 w-3.5" /> مسح الفلاتر
            </Button>
          )}
        </div>
      </div>

      <p className="text-sm text-lunex-gray">{filtered.length} نتيجة</p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {loading
          ? Array.from({ length: 12 }).map((_, i) => <SeriesCardSkeleton key={i} />)
          : paged.map((s) => <SeriesCard key={s.id} series={s} />)}
      </div>

      {!loading && paged.length === 0 && (
        <div className="panel p-10 text-center text-lunex-gray">
          لا توجد نتائج مطابقة لبحثك، جرّب تعديل الفلاتر.
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            السابق
          </Button>
          <Badge variant="secondary">{page} / {totalPages}</Badge>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            التالي
          </Button>
        </div>
      )}
    </div>
  );
}
