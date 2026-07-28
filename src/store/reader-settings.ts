"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ReaderMode = "vertical" | "horizontal" | "page";
export type ReaderFit = "width" | "height" | "original";

interface ReaderSettingsState {
  mode: ReaderMode;
  fit: ReaderFit;
  zoom: number;
  brightness: number;
  contrast: number;
  rtl: boolean;
  setMode: (mode: ReaderMode) => void;
  setFit: (fit: ReaderFit) => void;
  setZoom: (zoom: number) => void;
  setBrightness: (v: number) => void;
  setContrast: (v: number) => void;
  setRtl: (v: boolean) => void;
}

export const useReaderSettings = create<ReaderSettingsState>()(
  persist(
    (set) => ({
      mode: "vertical",
      fit: "width",
      zoom: 100,
      brightness: 100,
      contrast: 100,
      rtl: true,
      setMode: (mode) => set({ mode }),
      setFit: (fit) => set({ fit }),
      setZoom: (zoom) => set({ zoom }),
      setBrightness: (brightness) => set({ brightness }),
      setContrast: (contrast) => set({ contrast }),
      setRtl: (rtl) => set({ rtl }),
    }),
    { name: "lunex-reader-settings" }
  )
);

interface ReadingProgressState {
  progress: Record<string, number>;
  setProgress: (seriesId: string, chapterNumber: number) => void;
  getProgress: (seriesId: string) => number | undefined;
}

export const useReadingProgress = create<ReadingProgressState>()(
  persist(
    (set, get) => ({
      progress: {},
      setProgress: (seriesId, chapterNumber) =>
        set((s) => ({ progress: { ...s.progress, [seriesId]: chapterNumber } })),
      getProgress: (seriesId) => get().progress[seriesId],
    }),
    { name: "lunex-reading-progress" }
  )
);

interface BookmarksState {
  bookmarks: string[];
  toggleBookmark: (seriesId: string) => void;
  isBookmarked: (seriesId: string) => boolean;
}

export const useBookmarks = create<BookmarksState>()(
  persist(
    (set, get) => ({
      bookmarks: [],
      toggleBookmark: (seriesId) =>
        set((s) => ({
          bookmarks: s.bookmarks.includes(seriesId)
            ? s.bookmarks.filter((id) => id !== seriesId)
            : [...s.bookmarks, seriesId],
        })),
      isBookmarked: (seriesId) => get().bookmarks.includes(seriesId),
    }),
    { name: "lunex-bookmarks" }
  )
);
