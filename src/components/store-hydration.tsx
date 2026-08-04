"use client";

import { useEffect } from "react";
import type { BackendPublicUser } from "@/lib/auth-types";
import { mergeRealUsers } from "@/lib/mock/generate";
import { useReaderSettings, useReadingProgress, useBookmarks } from "@/store/reader-settings";
import { useTeamManagement } from "@/store/team-management";
import { useProfile } from "@/store/profile";
import { useRatings } from "@/store/ratings";
import { useRealUsers, synthesizeProfile } from "@/store/real-users";
import { useRewards } from "@/store/rewards";
import { useMessages } from "@/store/messages";
import { useSession } from "@/store/session";

/**
 * All persisted stores use `skipHydration: true` so the first client render
 * matches the server exactly (no localStorage on the server). Rehydrating
 * here, after mount, applies the persisted values as a normal post-mount
 * state update instead of a hydration mismatch.
 *
 * `initialUser` comes from the root layout's server-side getServerSession()
 * call — the session store itself is no longer persisted (see store/
 * session.ts), so this is the only path that ever populates it.
 */
export function StoreHydration({ initialUser }: { initialUser: BackendPublicUser | null }) {
  useEffect(() => {
    useSession.getState().setUser(initialUser);

    useReaderSettings.persist.rehydrate();
    useReadingProgress.persist.rehydrate();
    useBookmarks.persist.rehydrate();
    useTeamManagement.persist.rehydrate();
    useProfile.persist.rehydrate();
    useRewards.persist.rehydrate();
    useMessages.persist.rehydrate();
    useRatings.persist.rehydrate();

    // rehydrate() resolves asynchronously — upserting the current login's
    // profile (and merging into the mock DB) must wait for that to finish,
    // or a still-loading persisted `profiles` map would overwrite it.
    const unsubscribe = useRealUsers.persist.onFinishHydration(() => {
      if (initialUser) {
        useRealUsers.getState().upsertProfile(synthesizeProfile(initialUser));
      }
      mergeRealUsers(useRealUsers.getState().profiles);
    });
    useRealUsers.persist.rehydrate();

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
