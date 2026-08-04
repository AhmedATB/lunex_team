"use client";

import { create } from "zustand";
import type { BackendPublicUser } from "@/lib/auth-types";

interface SessionState {
  user: BackendPublicUser | null;
  /** Derived from `user` — kept so the many existing call sites that only need the id (not the full user) don't all need rewriting. */
  currentUserId: string | null;
  isGuest: boolean;
  setUser: (user: BackendPublicUser | null) => void;
  logout: () => Promise<void>;
}

/**
 * No `persist` middleware here anymore, deliberately: the real source of
 * truth for "who is logged in" is the httpOnly session cookie the backend
 * issued, not localStorage. This store is just a client-side mirror of that,
 * populated once per page load from the server-rendered session (see
 * StoreHydration + getServerSession) — never the other way around.
 */
export const useSession = create<SessionState>((set) => ({
  user: null,
  currentUserId: null,
  isGuest: true,
  setUser: (user) => set({ user, currentUserId: user?.id ?? null, isGuest: !user }),
  logout: async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    set({ user: null, currentUserId: null, isGuest: true });
  },
}));
