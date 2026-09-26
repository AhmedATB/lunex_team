import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isLockedByRule, walletConfig, type WalletConfig } from "./wallet.config";
import { WalletRepository, type UnlockMethod } from "./wallet.repository";

/** Roles that read every chapter without unlocking it: the people who publish and run the site. */
const READ_EVERYTHING_ROLES = new Set(["uploader", "editor", "super_administrator", "owner"]);
/** Only these hand out coins. */
const COIN_GRANTERS = new Set(["super_administrator", "owner"]);
const MAX_GRANT = 100_000;

export interface WalletDto extends WalletConfig {
  coins: number;
  unlockCredits: number;
  /** Finished chapters counted toward the next credit. */
  creditProgress: number;
  /** Chapters this member has opened (only those that were locked need to appear here). */
  unlockedChapterIds: string[];
}

export interface AccessDto {
  locked: boolean;
  /** Whether this member may read it now (free, opened, or staff). */
  canRead: boolean;
}

/**
 * Coins and unlock credits, and what they buy: the right to read a locked chapter. Everything is decided here from the
 * account's own balances — nothing the browser says about what it owns is believed.
 */
@Injectable()
export class WalletService {
  constructor(
    private readonly repo: WalletRepository,
    private readonly env: ConfigService
  ) {}

  private config(): WalletConfig {
    return walletConfig({
      LOCKED_CHAPTER_COUNT: this.env.get<string>("LOCKED_CHAPTER_COUNT"),
      FREE_FIRST_CHAPTERS: this.env.get<string>("FREE_FIRST_CHAPTERS"),
      CHAPTERS_PER_CREDIT: this.env.get<string>("CHAPTERS_PER_CREDIT"),
      CHAPTER_COIN_PRICE: this.env.get<string>("CHAPTER_COIN_PRICE"),
    });
  }

  async snapshot(userId: string): Promise<WalletDto> {
    const [account, unlockedChapterIds] = await Promise.all([this.repo.findAccount(userId), this.repo.listUnlockedChapterIds(userId)]);
    if (!account) throw new NotFoundException({ code: "user_not_found", message: "Account not found." });
    return {
      ...this.config(),
      coins: account.coins,
      unlockCredits: account.unlockCredits,
      creditProgress: account.creditProgress,
      unlockedChapterIds,
    };
  }

  /** Is this chapter locked, and may this member read it? The one place both questions are answered (page tokens ask it too). */
  async access(userId: string, chapterId: string): Promise<AccessDto> {
    const chapter = await this.repo.findChapter(chapterId);
    if (!chapter) throw new NotFoundException({ code: "chapter_not_found", message: "Chapter not found." });

    const latest = await this.repo.latestPublishedNumber(chapter.seriesId);
    const locked = isLockedByRule(chapter.number, latest, this.config(), chapter.manualLock);
    if (!locked) return { locked: false, canRead: true };

    const account = await this.repo.findAccount(userId);
    if (account && READ_EVERYTHING_ROLES.has(account.role)) return { locked: true, canRead: true };
    return { locked: true, canRead: Boolean(await this.repo.findUnlock(userId, chapterId)) };
  }

  /** Opens a locked chapter, paying with a reading credit or with coins. Opening a chapter that needs no payment costs nothing. */
  async unlockChapter(userId: string, chapterId: string, method: UnlockMethod): Promise<WalletDto & { unlocked: true }> {
    const status = await this.access(userId, chapterId);
    if (!status.locked || status.canRead) return { ...(await this.snapshot(userId)), unlocked: true };

    const outcome = await this.repo.spendToUnlock({ userId, chapterId, method, price: this.config().coinPrice });
    if (outcome === "no_account") throw new NotFoundException({ code: "user_not_found", message: "Account not found." });
    if (outcome === "no_credit") {
      throw new HttpException({ code: "insufficient_credits", message: "You have no reading credits to spend." }, HttpStatus.PAYMENT_REQUIRED);
    }
    if (outcome === "no_coins") {
      throw new HttpException({ code: "insufficient_coins", message: "You do not have enough coins." }, HttpStatus.PAYMENT_REQUIRED);
    }
    return { ...(await this.snapshot(userId)), unlocked: true };
  }

  /** An owner or super administrator adds coins to a member (after receiving payment outside the site). */
  async grantCoins(actorId: string, username: string, amount: number, note: string | undefined) {
    const actor = await this.repo.findAccount(actorId);
    if (!actor || !COIN_GRANTERS.has(actor.role)) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "Only the owner or a super administrator can grant coins." });
    }
    if (!Number.isInteger(amount) || amount < 1 || amount > MAX_GRANT) {
      throw new BadRequestException({ code: "invalid_amount", message: `Grant between 1 and ${MAX_GRANT} coins.` });
    }
    const target = await this.repo.findAccountByUsername(username);
    if (!target) throw new NotFoundException({ code: "user_not_found", message: "No member has that username." });
    const coins = await this.repo.grantCoins({ userId: target.id, amount, actorId, note: note?.trim() || null });
    return { username: target.username, granted: amount, coins };
  }

  async recentTransactions(actorId: string, take = 50) {
    const actor = await this.repo.findAccount(actorId);
    if (!actor || !COIN_GRANTERS.has(actor.role)) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "Only the owner or a super administrator can see coin transactions." });
    }
    const rows = await this.repo.recentTransactions(Math.min(Math.max(take, 1), 200));
    return rows.map((r) => ({ id: r.id, username: r.user.username, amount: r.amount, reason: r.reason, chapterId: r.chapterId, note: r.note, createdAt: r.createdAt }));
  }
}
