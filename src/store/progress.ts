"use client";

import { create } from "zustand";
import { ACHIEVEMENT_INFO } from "@/lib/achievements";
import { useSession } from "@/store/session";
import { useToast } from "@/store/toast";

/** The signed-in reader's progression, as the server reports it (backend modules/progress). Never edited in the browser. */
export interface Progress {
  xp: number;
  level: number;
  xpIntoLevel: number;
  levelSpan: number;
  xpToNext: number;
  streak: number;
  bestStreak: number;
  chaptersRead: number;
  comments: number;
  bookmarks: number;
  todayXp: number;
  dailyCap: number;
  achievements: string[];
}

interface CompleteResponse {
  awarded: boolean;
  xpGained: number;
  leveledUp: boolean;
  progress: Progress;
}

interface ProgressState {
  progress: Progress | null;
  /** Whose numbers these are, so the difference between two different people is never celebrated. */
  ownerId: string | null;
  /** Loads the server's numbers; anything that moved since the last look is announced. */
  refresh: () => Promise<void>;
  /** The reader reached the end of a chapter: the server decides whether it earns experience. */
  complete: (chapterId: string) => Promise<void>;
  reset: () => void;
}

/** Tells the reader what just changed: experience, a new level, a new achievement. Silent the first time (nothing to compare with). */
function announce(previous: Progress, next: Progress) {
  const push = useToast.getState().push;
  const gained = next.xp - previous.xp;
  if (next.level > previous.level) {
    push({ title: `مستوى جديد: ${next.level}`, description: gained > 0 ? `+${gained} XP` : undefined });
  } else if (gained > 0) {
    push({ title: `+${gained} XP`, description: `المستوى ${next.level} · ${next.xpIntoLevel}/${next.levelSpan}` });
  }
  for (const id of next.achievements) {
    if (previous.achievements.includes(id)) continue;
    const info = ACHIEVEMENT_INFO[id];
    if (info) push({ title: `إنجاز جديد: ${info.title}`, description: info.description });
  }
}

export const useProgress = create<ProgressState>((set, get) => {
  function take(next: Progress) {
    const ownerId = useSession.getState().currentUserId;
    const { progress: previous, ownerId: previousOwner } = get();
    if (previous && previousOwner === ownerId) announce(previous, next);
    set({ progress: next, ownerId });
  }

  return {
    progress: null,
    ownerId: null,

    refresh: async () => {
      if (!useSession.getState().currentUserId) return get().reset();
      try {
        const res = await fetch("/api/me/progress", { cache: "no-store" });
        if (res.ok) take((await res.json()) as Progress);
      } catch {
        // offline or the server is restarting: keep what is shown, the next look will catch up
      }
    },

    complete: async (chapterId) => {
      if (!useSession.getState().currentUserId) return;
      try {
        const res = await fetch("/api/me/reading/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chapterId }),
        });
        if (res.ok) take(((await res.json()) as CompleteResponse).progress);
      } catch {
        // the chapter still counts for the view and the history; only the experience is missed
      }
    },

    reset: () => set({ progress: null, ownerId: null }),
  };
});
