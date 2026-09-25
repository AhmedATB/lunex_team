"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { resolveAvatarUrl } from "@/lib/utils";

interface ProfileState {
  avatarOverrides: Record<string, string>;
  setAvatarSeed: (userId: string, seed: string) => void;
}

export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      avatarOverrides: {},
      setAvatarSeed: (userId, seed) =>
        set((s) => ({ avatarOverrides: { ...s.avatarOverrides, [userId]: seed } })),
    }),
    { name: "lunex-profile", skipHydration: true }
  )
);

/** Resolves a user's effective avatar seed — their chosen override, if any, else their seeded default. */
export function effectiveAvatarSeed(
  user: { id: string; avatarSeed: string },
  overrides: Record<string, string>
): string {
  return overrides[user.id] ?? user.avatarSeed;
}

/**
 * The picture to show for a user, everywhere. An uploaded avatar (`avatarVersion` set) always wins; otherwise the
 * picked/seeded placeholder is drawn locally (see lib/generated-avatar.ts). Use this instead of building an avatar URL
 * from the seed alone, which is what left uploaded photos missing from comments, lists and team pages.
 */
export function avatarSrcFor(
  user: { id: string; avatarSeed: string; avatarVersion?: string | null },
  overrides: Record<string, string>
): string {
  return resolveAvatarUrl(user.id, user.avatarVersion, effectiveAvatarSeed(user, overrides));
}
