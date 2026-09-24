import { create } from "zustand";

/**
 * The destination of a navigation that has started but not yet landed.
 * Next.js keeps showing the old page until the server answers, and shows no
 * loading UI at all when only the query string changes (e.g. الاستكشاف ↔
 * الروايات) — so the click itself records the destination and the UI reacts
 * immediately.
 */
interface NavigationState {
  pendingHref: string | null;
  start: (href: string) => void;
  finish: () => void;
}

export const useNavigation = create<NavigationState>((set) => ({
  pendingHref: null,
  start: (pendingHref) => set({ pendingHref }),
  finish: () => set((s) => (s.pendingHref === null ? s : { pendingHref: null })),
}));
