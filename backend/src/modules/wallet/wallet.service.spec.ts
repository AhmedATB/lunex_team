import type { NotificationsService } from "../notifications/notifications.service";
import { BadRequestException, ForbiddenException, HttpException, NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { SpendOutcome, WalletRepository } from "./wallet.repository";
import { WalletService } from "./wallet.service";

const CONFIG_VALUES: Record<string, string> = { CHAPTER_COIN_PRICE: "50" };

interface Setup {
  role?: string;
  chapter?: { id: string; seriesId: string; number: number; manualLock: boolean | null } | null;
  latest?: number;
  unlocked?: boolean;
  spend?: SpendOutcome;
  coins?: number;
}

function build(setup: Setup = {}) {
  const chapter = setup.chapter === undefined ? { id: "c20", seriesId: "s1", number: 20, manualLock: null } : setup.chapter;
  const repo = {
    findChapter: jest.fn(async () => chapter),
    latestPublishedNumber: jest.fn(async () => setup.latest ?? 20),
    findAccount: jest.fn(async () => ({ id: "u1", role: setup.role ?? "reader", coins: setup.coins ?? 0, unlockCredits: 1, creditProgress: 3 })),
    findAccountByUsername: jest.fn(async (name: string) => (name === "kaito" ? { id: "u2", username: "kaito", role: "reader" } : null)),
    findUnlock: jest.fn(async () => (setup.unlocked ? { id: "x" } : null)),
    listUnlockedChapterIds: jest.fn(async () => (setup.unlocked ? ["c20"] : [])),
    spendToUnlock: jest.fn(async () => setup.spend ?? "unlocked"),
    grantCoins: jest.fn(async () => 120),
    recentTransactions: jest.fn(async () => []),
  };
  const env = { get: (name: string) => CONFIG_VALUES[name] } as unknown as ConfigService;
  const notifications = { coinsGranted: jest.fn().mockResolvedValue(undefined) };
  return { service: new WalletService(repo as unknown as WalletRepository, env, notifications as unknown as NotificationsService), repo, notifications };
}

describe("who may read a chapter", () => {
  it("lets anyone read a chapter that is not locked", async () => {
    const { service, repo } = build({ chapter: { id: "c5", seriesId: "s1", number: 5, manualLock: null } });
    expect(await service.access("u1", "c5")).toEqual({ locked: false, canRead: true });
    expect(repo.findUnlock).not.toHaveBeenCalled();
  });

  it("lets a visitor without an account read a chapter that is not locked, and never a locked one", async () => {
    const open = build({ chapter: { id: "c5", seriesId: "s1", number: 5, manualLock: null } });
    expect(await open.service.access(null, "c5")).toEqual({ locked: false, canRead: true });
    const locked = build();
    expect(await locked.service.access(null, "c20")).toEqual({ locked: true, canRead: false });
    // nobody to look up: no account, no unlock, no staff role to consult
    expect(locked.repo.findAccount).not.toHaveBeenCalled();
    expect(locked.repo.findUnlock).not.toHaveBeenCalled();
  });

  it("keeps a locked chapter closed until it is opened", async () => {
    expect(await build().service.access("u1", "c20")).toEqual({ locked: true, canRead: false });
    expect(await build({ unlocked: true }).service.access("u1", "c20")).toEqual({ locked: true, canRead: true });
  });

  it("lets the people who publish read everything", async () => {
    for (const role of ["uploader", "editor", "super_administrator", "owner"]) {
      expect(await build({ role }).service.access("u1", "c20")).toEqual({ locked: true, canRead: true });
    }
    expect((await build({ role: "moderator" }).service.access("u1", "c20")).canRead).toBe(false);
  });

  it("honours a staff override in both directions", async () => {
    expect((await build({ chapter: { id: "c2", seriesId: "s1", number: 2, manualLock: true } }).service.access("u1", "c2")).locked).toBe(true);
    expect((await build({ chapter: { id: "c20", seriesId: "s1", number: 20, manualLock: false } }).service.access("u1", "c20")).locked).toBe(false);
  });

  it("refuses a chapter that does not exist", async () => {
    await expect(build({ chapter: null }).service.access("u1", "nope")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("opening a locked chapter", () => {
  it("spends what was asked for and reports the new balances", async () => {
    const { service, repo } = build();
    const wallet = await service.unlockChapter("u1", "c20", "credit");
    expect(repo.spendToUnlock).toHaveBeenCalledWith({ userId: "u1", chapterId: "c20", method: "credit", price: 50 });
    expect(wallet).toMatchObject({ unlocked: true, coinPrice: 50, chaptersPerCredit: 10 });
  });

  it("charges the configured price when paying with coins", async () => {
    const { service, repo } = build({ coins: 80 });
    await service.unlockChapter("u1", "c20", "coins");
    expect(repo.spendToUnlock).toHaveBeenCalledWith({ userId: "u1", chapterId: "c20", method: "coins", price: 50 });
  });

  it("answers 402 when there is no credit or not enough coins", async () => {
    for (const [outcome, code] of [["no_credit", "insufficient_credits"], ["no_coins", "insufficient_coins"]] as const) {
      const { service } = build({ spend: outcome });
      await expect(service.unlockChapter("u1", "c20", outcome === "no_credit" ? "credit" : "coins")).rejects.toMatchObject({ status: 402, response: { code } });
    }
  });

  it("costs nothing when the chapter needs no payment, or is already open", async () => {
    const free = build({ chapter: { id: "c5", seriesId: "s1", number: 5, manualLock: null } });
    await free.service.unlockChapter("u1", "c5", "coins");
    expect(free.repo.spendToUnlock).not.toHaveBeenCalled();

    const open = build({ unlocked: true });
    await open.service.unlockChapter("u1", "c20", "credit");
    expect(open.repo.spendToUnlock).not.toHaveBeenCalled();
  });

  it("does not charge a member of staff for a chapter they can read anyway", async () => {
    const { service, repo } = build({ role: "editor" });
    await service.unlockChapter("u1", "c20", "coins");
    expect(repo.spendToUnlock).not.toHaveBeenCalled();
  });

  it("is an HttpException carrying Payment Required, not a server error", async () => {
    const { service } = build({ spend: "no_coins" });
    await expect(service.unlockChapter("u1", "c20", "coins")).rejects.toBeInstanceOf(HttpException);
  });
});

describe("granting coins", () => {
  it("is for the owner and super administrators only", async () => {
    for (const role of ["reader", "editor", "moderator", "uploader"]) {
      await expect(build({ role }).service.grantCoins("u1", "kaito", 100, undefined)).rejects.toBeInstanceOf(ForbiddenException);
    }
    for (const role of ["owner", "super_administrator"]) {
      const { service, repo } = build({ role });
      expect(await service.grantCoins("u1", "kaito", 100, " paid via transfer ")).toEqual({ username: "kaito", granted: 100, coins: 120 });
      expect(repo.grantCoins).toHaveBeenCalledWith({ userId: "u2", amount: 100, actorId: "u1", note: "paid via transfer" });
    }
  });

  it("refuses an amount that is not a whole number between 1 and 100000", async () => {
    const { service, repo } = build({ role: "owner" });
    for (const amount of [0, -5, 1.5, 100_001, Number.NaN]) {
      await expect(service.grantCoins("u1", "kaito", amount, undefined)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(repo.grantCoins).not.toHaveBeenCalled();
  });

  it("refuses a member who does not exist", async () => {
    await expect(build({ role: "owner" }).service.grantCoins("u1", "ghost", 10, undefined)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("shows the ledger only to those who may grant", async () => {
    await expect(build({ role: "reader" }).service.recentTransactions("u1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(await build({ role: "owner" }).service.recentTransactions("u1")).toEqual([]);
  });
});
