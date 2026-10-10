/**
 * How the chapter lock is set up. The owner or a super administrator sets it from the admin panel (kept in the database,
 * see WalletSettingsService); where nothing has been set it comes from the environment (Railway variables), and failing
 * that from the defaults below. The frontend never assumes these — members are told them by `GET /v1/me/wallet` and
 * everyone else by `GET /v1/wallet/rule` — so the two cannot drift apart.
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

/** What each setting may be set to. */
export const WALLET_LIMITS: Record<keyof WalletConfig, { min: number; max: number }> = {
  lockedWindow: { min: 0, max: 50 },
  freeFirstChapters: { min: 0, max: 50 },
  chaptersPerCredit: { min: 1, max: 1000 },
  coinPrice: { min: 1, max: 100_000 },
};

export const WALLET_KEYS = Object.keys(WALLET_LIMITS) as (keyof WalletConfig)[];

/** Settings changed from the admin panel; a missing one falls back to the environment. */
export type WalletOverrides = Partial<WalletConfig>;

function positiveInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

/** Keeps only the settings that are whole numbers inside their limits, whatever was stored. */
export function validOverrides(raw: unknown): WalletOverrides {
  const out: WalletOverrides = {};
  if (typeof raw !== "object" || raw === null) return out;
  for (const key of WALLET_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    const { min, max } = WALLET_LIMITS[key];
    if (typeof value === "number" && Number.isInteger(value) && value >= min && value <= max) out[key] = value;
  }
  return out;
}

/** The launch default locks nothing: for the first month every chapter is open to read. */
export function walletConfig(env: Record<string, string | undefined> = process.env, overrides: WalletOverrides = {}): WalletConfig {
  return {
    lockedWindow: positiveInt(env.LOCKED_CHAPTER_COUNT, 0, 0, 50),
    freeFirstChapters: positiveInt(env.FREE_FIRST_CHAPTERS, 3, 0, 50),
    chaptersPerCredit: positiveInt(env.CHAPTERS_PER_CREDIT, 10, 1, 1000),
    coinPrice: positiveInt(env.CHAPTER_COIN_PRICE, 50, 1, 100_000),
    ...validOverrides(overrides),
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
