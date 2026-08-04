"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { useSession } from "@/store/session";
import { useRatings, getEffectiveRating } from "@/store/ratings";
import { cn, formatNumber } from "@/lib/utils";

export function RatingWidget({
  seriesId,
  baseRating,
  baseRatingCount,
}: {
  seriesId: string;
  baseRating: number;
  baseRatingCount: number;
}) {
  const currentUserId = useSession((s) => s.currentUserId);
  const seriesRatings = useRatings((s) => s.ratings[seriesId]);
  const setRating = useRatings((s) => s.setRating);
  const [hover, setHover] = useState(0);

  const { rating, ratingCount } = getEffectiveRating({ rating: baseRating, ratingCount: baseRatingCount }, seriesRatings);
  const myRating = currentUserId ? seriesRatings?.[currentUserId] ?? 0 : 0;

  return (
    <div className="panel panel-hover space-y-2 p-4">
      <div className="flex items-center gap-2">
        <Star className="h-5 w-5 fill-amber-300 text-amber-300" />
        <span className="font-display text-lg font-bold text-white">{rating}</span>
        <span className="text-xs text-lunex-gray">({formatNumber(ratingCount)} تقييم)</span>
      </div>

      {currentUserId ? (
        <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              aria-label={`قيّم ${v} من 5`}
              onMouseEnter={() => setHover(v)}
              onClick={() => setRating(seriesId, currentUserId, v)}
              className="hover-pop p-0.5"
            >
              <Star
                className={cn(
                  "h-5 w-5 transition-colors",
                  (hover || myRating) >= v ? "fill-primary-400 text-primary-400" : "fill-transparent text-lunex-gray"
                )}
              />
            </button>
          ))}
          {myRating > 0 && <span className="ms-1 text-[11px] text-primary-300">تقييمك: {myRating}</span>}
        </div>
      ) : (
        <p className="text-xs text-lunex-gray">سجّل الدخول لتقييم هذا العمل.</p>
      )}
    </div>
  );
}
