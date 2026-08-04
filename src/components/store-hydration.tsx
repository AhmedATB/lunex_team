"use client";

import { useEffect } from "react";
import { useSession } from "@/store/session";
import { useReaderSettings, useReadingProgress, useBookmarks } from "@/store/reader-settings";
import { useTeamManagement } from "@/store/team-management";
import { useProfile } from "@/store/profile";
import { useRatings } from "@/store/ratings";
import { useRewards } from "@/store/rewards";
import { useMessages } from "@/store/messages";

/**
 * All persisted stores use `skipHydration: true` so the first client render
 * matches the server exactly (no localStorage on the server). Rehydrating
 * here, after mount, applies the persisted values as a normal post-mount
 * state update instead of a hydration mismatch.
 */
export function StoreHydration() {
  useEffect(() => {
    useSession.persist.rehydrate();
    useReaderSettings.persist.rehydrate();
    useReadingProgress.persist.rehydrate();
    useBookmarks.persist.rehydrate();
    useTeamManagement.persist.rehydrate();
    useProfile.persist.rehydrate();
    useRewards.persist.rehydrate();
    useMessages.persist.rehydrate();
    useRatings.persist.rehydrate();
  }, []);

  return null;
}
