"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface MonetizationSettings {
  adsPerUnlock: number;
  dailyReadTarget: number;
  chapterCoinPrice: number;
  lockedChapterCount: number;
}

export const DEFAULT_MONETIZATION_SETTINGS: MonetizationSettings = {
  adsPerUnlock: 3,
  dailyReadTarget: 15,
  chapterCoinPrice: 50,
  lockedChapterCount: 3,
};

interface RewardsState {
  coins: number;
  adsWatched: number;
  freeUnlockCredits: number;
  unlockedChapters: string[];
  dailyDate: string;
  dailyReadKeys: string[];
  dailyRewardClaimed: boolean;
  settings: MonetizationSettings;

  watchAd: () => void;
  recordChapterRead: (key: string) => void;
  claimDailyReward: (chapterKey: string) => boolean;
  unlockWithCredit: (key: string) => boolean;
  unlockWithCoins: (key: string) => boolean;
  buyCoins: (amount: number) => void;
  updateSettings: (patch: Partial<MonetizationSettings>) => void;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** Resets the daily counters when the stored day is not today — called at the top of every daily-sensitive action. */
function rolledDaily(s: Pick<RewardsState, "dailyDate" | "dailyReadKeys" | "dailyRewardClaimed">) {
  const today = todayKey();
  if (s.dailyDate === today) {
    return { dailyDate: s.dailyDate, dailyReadKeys: s.dailyReadKeys, dailyRewardClaimed: s.dailyRewardClaimed };
  }
  return { dailyDate: today, dailyReadKeys: [] as string[], dailyRewardClaimed: false };
}

export const useRewards = create<RewardsState>()(
  persist(
    (set, get) => ({
      coins: 100,
      adsWatched: 0,
      freeUnlockCredits: 0,
      unlockedChapters: [],
      dailyDate: todayKey(),
      dailyReadKeys: [],
      dailyRewardClaimed: false,
      settings: DEFAULT_MONETIZATION_SETTINGS,

      watchAd: () => {
        set((s) => {
          const next = s.adsWatched + 1;
          if (next >= s.settings.adsPerUnlock) {
            return { adsWatched: 0, freeUnlockCredits: s.freeUnlockCredits + 1 };
          }
          return { adsWatched: next };
        });
      },

      recordChapterRead: (key) => {
        set((s) => {
          const daily = rolledDaily(s);
          if (daily.dailyReadKeys.includes(key)) return daily;
          return { ...daily, dailyReadKeys: [...daily.dailyReadKeys, key] };
        });
      },

      claimDailyReward: (chapterKey) => {
        const s = get();
        const daily = rolledDaily(s);
        if (daily.dailyRewardClaimed || daily.dailyReadKeys.length < s.settings.dailyReadTarget) {
          set(daily);
          return false;
        }
        set({
          ...daily,
          dailyRewardClaimed: true,
          unlockedChapters: [...s.unlockedChapters, chapterKey],
        });
        return true;
      },

      unlockWithCredit: (key) => {
        const s = get();
        if (s.freeUnlockCredits < 1) return false;
        set({
          freeUnlockCredits: s.freeUnlockCredits - 1,
          unlockedChapters: [...s.unlockedChapters, key],
        });
        return true;
      },

      unlockWithCoins: (key) => {
        const s = get();
        if (s.coins < s.settings.chapterCoinPrice) return false;
        set({
          coins: s.coins - s.settings.chapterCoinPrice,
          unlockedChapters: [...s.unlockedChapters, key],
        });
        return true;
      },

      buyCoins: (amount) => {
        set((s) => ({ coins: s.coins + amount }));
      },

      updateSettings: (patch) => {
        set((s) => ({ settings: { ...s.settings, ...patch } }));
      },
    }),
    { name: "lunex-rewards", skipHydration: true }
  )
);

export function chapterKey(seriesId: string, chapterNumber: number): string {
  return `${seriesId}:${chapterNumber}`;
}

/**
 * The newest N chapters of every series are premium-locked; everything older is
 * free. Derived from the chapter number rather than stored per chapter, so the
 * lock window slides automatically as new chapters release.
 *
 * A team leader/admin can override this automatic rule per chapter via
 * `manualLock` (true = force-locked, false = force-open, undefined = automatic).
 * A manual lock still respects a reader's purchase — someone who already paid
 * to unlock a chapter keeps access even if a leader later force-locks it again.
 */
export function isChapterLocked(
  chapterNumber: number,
  latestChapterNumber: number,
  lockedChapterCount: number,
  unlockedChapters: string[],
  seriesId: string,
  manualLock?: boolean
): boolean {
  const alreadyUnlocked = unlockedChapters.includes(chapterKey(seriesId, chapterNumber));
  if (manualLock === false) return false;
  if (manualLock === true) return !alreadyUnlocked;
  if (chapterNumber <= latestChapterNumber - lockedChapterCount) return false;
  return !alreadyUnlocked;
}
