"use client";

import { create } from "zustand";

/**
 * Whether the reader toolbar is shown, on mobile — tap-to-toggle, with a 3s
 * auto-hide once shown. Deliberately NOT persisted (resets every page load)
 * and never touched by scroll: scrolling must never reveal it, only a tap
 * can, per the reading-app convention this mirrors.
 */
interface ReaderChromeState {
  toolbarVisible: boolean;
  toggleToolbar: () => void;
}

let hideTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAutoHide(set: (partial: Partial<ReaderChromeState>) => void) {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => set({ toolbarVisible: false }), 3000);
}

export const useReaderChrome = create<ReaderChromeState>((set, get) => ({
  toolbarVisible: true,
  toggleToolbar: () => {
    const next = !get().toolbarVisible;
    if (hideTimer) clearTimeout(hideTimer);
    set({ toolbarVisible: next });
    if (next) scheduleAutoHide(set);
  },
}));
