"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

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
