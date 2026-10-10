/**
 * Which chapters look locked. This mirrors the server's rule (backend modules/wallet/wallet.config.ts, isLockedByRule) so
 * a lock icon and the lock screen agree with what the server will actually refuse — but it only decides what is *shown*.
 * The server is the one that refuses a page to someone who has not opened a locked chapter.
 */
export interface LockRule {
  /** How many of a series' newest chapters are locked. */
  lockedWindow: number;
  /** A series' first chapters are always free. */
  freeFirstChapters: number;
}

/** What the server ships with (nothing locked); used only until the server's rule has loaded, so the screen does not flash the wrong thing. */
export const DEFAULT_LOCK_RULE: LockRule = { lockedWindow: 0, freeFirstChapters: 3 };

export function isLockedByRule(chapterNumber: number, latestChapterNumber: number, rule: LockRule, manualLock: boolean | null | undefined): boolean {
  if (manualLock === true) return true;
  if (manualLock === false) return false;
  if (rule.lockedWindow <= 0) return false;
  if (chapterNumber <= rule.freeFirstChapters) return false;
  return chapterNumber > latestChapterNumber - rule.lockedWindow;
}
