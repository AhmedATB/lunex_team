"use client";

import { useEffect, useState } from "react";
import { useCatalog } from "@/components/catalog-provider";
import type { Chapter } from "@/lib/types";

interface WireChapter {
  id: string;
  seriesId: string;
  number: number;
  title: string;
  pages: number;
  hasContent: boolean;
  releasedAt: string;
  views: number;
  isPublished: boolean;
  scheduledFor?: string;
  teamId: string;
}

/**
 * The chapters of one series. With the real catalogue they are fetched from the
 * server (the catalogue only carries the newest few for the ticker); with the
 * built-in sample data they are already in memory. Returns an empty list until
 * the fetch lands — callers decide how to show that.
 */
export function useSeriesChapters(seriesId: string | undefined, slug: string | undefined): Chapter[] {
  const catalog = useCatalog();
  const [fetched, setFetched] = useState<{ seriesId: string; chapters: Chapter[] } | null>(null);
  const useSample = catalog.chapters.length > 0;

  useEffect(() => {
    if (useSample || !seriesId || !slug) return;
    let cancelled = false;
    fetch(`/api/catalog/series/${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { chapters: WireChapter[] } | null) => {
        if (cancelled || !body) return;
        setFetched({
          seriesId,
          chapters: body.chapters.map((c) => ({
            id: c.id,
            seriesId: c.seriesId,
            number: c.number,
            title: c.title,
            pages: c.pages,
            releasedAt: c.releasedAt,
            views: c.views,
            isPublished: c.isPublished,
            scheduledFor: c.scheduledFor,
            teamId: c.teamId,
          })),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [useSample, seriesId, slug]);

  if (useSample) return seriesId ? catalog.chapters.filter((c) => c.seriesId === seriesId) : [];
  return fetched && fetched.seriesId === seriesId ? fetched.chapters : [];
}
