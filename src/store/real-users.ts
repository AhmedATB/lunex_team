"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BackendPublicUser } from "@/lib/auth-types";
import type { GlobalRole, User } from "@/lib/types";

interface RealUsersState {
  profiles: Record<string, User>;
  upsertProfile: (user: User) => void;
}

/**
 * The real backend only knows identity (id/email/username/role) — everything
 * else in `User` (level, xp, badges, team affiliation, ...) belongs to
 * features that are still mock-data-backed (gamification, team management).
 * Rather than rip those out, every real account gets a synthesized default
 * profile stub here, persisted so it survives reloads, and merged into
 * getMockDatabase().users (see mergeRealUsers in lib/mock/generate.ts) so
 * every existing `.find(u => u.id === currentUserId)` call site across the
 * app keeps working unchanged for a genuinely new, real account.
 */
export const useRealUsers = create<RealUsersState>()(
  persist(
    (set) => ({
      profiles: {},
      upsertProfile: (user) => set((s) => ({ profiles: { ...s.profiles, [user.id]: user } })),
    }),
    { name: "lunex-real-users", skipHydration: true }
  )
);

/** Zero-state defaults for the fields the real backend doesn't track (yet). Identity fields (id/email/username/role) are the only ones that are ever real. */
export function synthesizeProfile(backendUser: BackendPublicUser): User {
  return {
    id: backendUser.id,
    username: backendUser.username,
    displayName: backendUser.username,
    avatarSeed: backendUser.id,
    email: backendUser.email,
    role: backendUser.role as GlobalRole,
    level: 1,
    xp: 0,
    xpToNext: 100,
    joinedAt: backendUser.createdAt,
    bio: "",
    isOnline: true,
    readCount: 0,
    commentCount: 0,
    bookmarkCount: 0,
    badges: [],
  };
}
