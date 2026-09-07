"use client";

import { useEffect, useRef } from "react";
import { useSession } from "@/store/session";
import { useRewards, computeStreak } from "@/store/rewards";
import { useComments } from "@/store/comments";
import { useBookmarks } from "@/store/reader-settings";
import { useAchievements } from "@/store/achievements";
import { useToast } from "@/store/toast";
import { ACHIEVEMENTS, type AchievementMetric } from "@/lib/achievements";

/**
 * Headless — mounted once in AppShell. Re-derives the tracked metrics on
 * every relevant store change and unlocks any achievement whose target is
 * newly met, celebrating with a toast. All metrics are client-tracked
 * (reading progress, authored comments, bookmarks) since there's no
 * server-side content model yet to derive them from instead.
 */
export function AchievementWatcher() {
  const currentUserId = useSession((s) => s.currentUserId);
  const chaptersRead = useRewards((s) => s.allTimeReadKeys.length);
  const readDates = useRewards((s) => s.readDates);
  const ownComments = useComments((s) => s.addedComments.filter((c) => c.userId === currentUserId).length);
  const bookmarks = useBookmarks((s) => s.bookmarks.length);
  const unlocked = useAchievements((s) => s.unlocked);
  const unlock = useAchievements((s) => s.unlock);
  const push = useToast((s) => s.push);
  const hydrated = useRef(false);

  useEffect(() => {
    // Skip the very first evaluation after mount — persisted stores rehydrate
    // asynchronously, so an early run would see zeros and could (harmlessly
    // but confusingly) fire a toast for something already unlocked earlier.
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    if (!currentUserId) return;

    const streak = computeStreak(readDates);
    const values: Record<AchievementMetric, number> = {
      chaptersRead,
      comments: ownComments,
      bookmarks,
      streak,
    };

    for (const def of ACHIEVEMENTS) {
      if (unlocked[def.id]) continue;
      if (values[def.metric] >= def.target) {
        unlock(def.id);
        push({ title: `إنجاز جديد: ${def.title}`, description: def.description });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, chaptersRead, readDates, ownComments, bookmarks]);

  return null;
}
