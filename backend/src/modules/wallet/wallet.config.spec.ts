import { isLockedByRule, walletConfig } from "./wallet.config";

const CONFIG = { lockedWindow: 3, freeFirstChapters: 3 };

describe("which chapters are locked", () => {
  it("locks the newest three of a long series and nothing older", () => {
    const locked = (n: number) => isLockedByRule(n, 20, CONFIG, null);
    expect([16, 17, 18, 19, 20].map(locked)).toEqual([false, false, true, true, true]);
    expect([1, 5, 10].some(locked)).toBe(false);
  });

  it("never locks the first chapters, so a short or new series can always be sampled", () => {
    for (const latest of [1, 2, 3, 4, 5, 6]) {
      for (let n = 1; n <= Math.min(3, latest); n++) expect(isLockedByRule(n, latest, CONFIG, null)).toBe(false);
    }
    expect(isLockedByRule(4, 4, CONFIG, null)).toBe(true);
    expect(isLockedByRule(6, 6, CONFIG, null)).toBe(true);
    expect(isLockedByRule(3, 6, CONFIG, null)).toBe(false);
  });

  it("lets a staff override decide, either way", () => {
    expect(isLockedByRule(2, 20, CONFIG, true)).toBe(true);
    expect(isLockedByRule(20, 20, CONFIG, false)).toBe(false);
  });

  it("can be switched off with a window of zero", () => {
    expect(isLockedByRule(20, 20, { lockedWindow: 0, freeFirstChapters: 3 }, null)).toBe(false);
  });

  it("handles half-numbered chapters", () => {
    expect(isLockedByRule(19.5, 20, CONFIG, null)).toBe(true);
    expect(isLockedByRule(3.5, 30, CONFIG, null)).toBe(false);
  });
});

describe("the configuration", () => {
  it("has the launch defaults", () => {
    expect(walletConfig({})).toEqual({ lockedWindow: 3, freeFirstChapters: 3, chaptersPerCredit: 10, coinPrice: 50 });
  });

  it("reads valid overrides and ignores nonsense", () => {
    expect(walletConfig({ LOCKED_CHAPTER_COUNT: "5", CHAPTERS_PER_CREDIT: "20", CHAPTER_COIN_PRICE: "100", FREE_FIRST_CHAPTERS: "0" })).toEqual({
      lockedWindow: 5, freeFirstChapters: 0, chaptersPerCredit: 20, coinPrice: 100,
    });
    expect(walletConfig({ LOCKED_CHAPTER_COUNT: "abc", CHAPTERS_PER_CREDIT: "0", CHAPTER_COIN_PRICE: "-4" })).toEqual({ lockedWindow: 3, freeFirstChapters: 3, chaptersPerCredit: 10, coinPrice: 50 });
  });
});
