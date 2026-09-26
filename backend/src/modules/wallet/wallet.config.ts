/**
 * How the chapter lock is set up. Read from the environment (Railway variables) so it can be tuned without a deploy of
 * code; the defaults are what the site launched with. The frontend never assumes these — it is told them by
 * `GET /v1/me/wallet` — so the two cannot drift apart.
 */
export interface WalletConfig {
  /** How many of a series' newest chapters are locked. 0 turns the lock off entirely. */
  lockedWindow: number;
  /** A series' first chapters are always free, whatever the window says (so a new series is never entirely locked). */
  freeFirstChapters: number;
  /** Finished chapters that earn one unlock credit. */
  chaptersPerCredit: number;
  /** Coins it costs to open one locked chapter. */
  coinPrice: number;
}

function positiveInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export function walletConfig(env: Record<string, string | undefined> = process.env): WalletConfig {
  return {
    lockedWindow: positiveInt(env.LOCKED_CHAPTER_COUNT, 3, 0, 50),
    freeFirstChapters: positiveInt(env.FREE_FIRST_CHAPTERS, 3, 0, 50),
    chaptersPerCredit: positiveInt(env.CHAPTERS_PER_CREDIT, 10, 1, 1000),
    coinPrice: positiveInt(env.CHAPTER_COIN_PRICE, 50, 1, 100_000),
  };
}

/**
 * Is a chapter locked for someone who has not opened it? A staff override wins (`true` = always locked, `false` = always
 * open); otherwise the newest `lockedWindow` chapters of the series are locked, except a series' first `freeFirstChapters`.
 */
export function isLockedByRule(
  chapterNumber: number,
  latestChapterNumber: number,
  config: Pick<WalletConfig, "lockedWindow" | "freeFirstChapters">,
  manualLock: boolean | null | undefined
): boolean {
  if (manualLock === true) return true;
  if (manualLock === false) return false;
  if (config.lockedWindow <= 0) return false;
  if (chapterNumber <= config.freeFirstChapters) return false;
  return chapterNumber > latestChapterNumber - config.lockedWindow;
}
