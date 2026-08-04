"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface RatingsState {
  /** seriesId -> { userId: 1-5 } */
  ratings: Record<string, Record<string, number>>;
  setRating: (seriesId: string, userId: string, value: number) => void;
}

export const useRatings = create<RatingsState>()(
  persist(
    (set) => ({
      ratings: {},
      setRating: (seriesId, userId, value) =>
        set((s) => ({
          ratings: { ...s.ratings, [seriesId]: { ...s.ratings[seriesId], [userId]: value } },
        })),
    }),
    { name: "lunex-ratings", skipHydration: true }
  )
);

/**
 * Blends the seeded baseline (rating/ratingCount from mock data) with any real
 * user ratings layered on top, so the displayed average shifts as people rate —
 * without needing to mutate the seeded numbers directly.
 */
export function getEffectiveRating(
  base: { rating: number; ratingCount: number },
  userRatings: Record<string, number> | undefined
): { rating: number; ratingCount: number } {
  const values = Object.values(userRatings ?? {});
  if (values.length === 0) return base;
  const baseSum = base.rating * base.ratingCount;
  const addedSum = values.reduce((sum, v) => sum + v, 0);
  const ratingCount = base.ratingCount + values.length;
  const rating = Math.round(((baseSum + addedSum) / ratingCount) * 10) / 10;
  return { rating, ratingCount };
}
