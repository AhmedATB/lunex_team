import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export type UnlockMethod = "credit" | "coins";

export type SpendOutcome = "unlocked" | "already_unlocked" | "no_credit" | "no_coins" | "no_account";

const MAX_UNLOCKS_LISTED = 5000;

@Injectable()
export class WalletRepository {
  constructor(private readonly prisma: PrismaService) {}

  findChapter(id: string) {
    return this.prisma.chapter.findFirst({ where: { id, isPublished: true }, select: { id: true, seriesId: true, number: true, manualLock: true } });
  }

  async latestPublishedNumber(seriesId: string): Promise<number> {
    const latest = await this.prisma.chapter.findFirst({ where: { seriesId, isPublished: true }, orderBy: { number: "desc" }, select: { number: true } });
    return latest?.number ?? 0;
  }

  findAccount(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, coins: true, unlockCredits: true, creditProgress: true } });
  }

  findAccountByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username }, select: { id: true, username: true, role: true } });
  }

  findUnlock(userId: string, chapterId: string) {
    return this.prisma.chapterUnlock.findUnique({ where: { userId_chapterId: { userId, chapterId } }, select: { id: true } });
  }

  async listUnlockedChapterIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.chapterUnlock.findMany({ where: { userId }, orderBy: { unlockedAt: "desc" }, take: MAX_UNLOCKS_LISTED, select: { chapterId: true } });
    return rows.map((r) => r.chapterId);
  }

  /**
   * Pays for opening a chapter and opens it, as one step under a row lock on the account: two requests at once cannot both
   * spend the same credit or the same coins, and a chapter opened twice is only ever paid for once.
   */
  spendToUnlock(params: { userId: string; chapterId: string; method: UnlockMethod; price: number }): Promise<SpendOutcome> {
    const { userId, chapterId, method, price } = params;
    return this.prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
        if (locked.length === 0) return "no_account";

        const existing = await tx.chapterUnlock.findUnique({ where: { userId_chapterId: { userId, chapterId } }, select: { id: true } });
        if (existing) return "already_unlocked";

        const account = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { coins: true, unlockCredits: true } });
        if (method === "credit") {
          if (account.unlockCredits < 1) return "no_credit";
          await tx.user.update({ where: { id: userId }, data: { unlockCredits: { decrement: 1 } } });
        } else {
          if (account.coins < price) return "no_coins";
          await tx.user.update({ where: { id: userId }, data: { coins: { decrement: price } } });
          await tx.coinTransaction.create({ data: { userId, amount: -price, reason: "unlock", chapterId } });
        }
        await tx.chapterUnlock.create({ data: { userId, chapterId, method } });
        return "unlocked";
      },
      { timeout: 10_000 }
    );
  }

  /** Adds coins to an account and records why, in one step. Returns the new balance. */
  async grantCoins(params: { userId: string; amount: number; actorId: string; note: string | null }): Promise<number> {
    const { userId, amount, actorId, note } = params;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: userId }, data: { coins: { increment: amount } }, select: { coins: true } });
      await tx.coinTransaction.create({ data: { userId, amount, reason: "grant", actorId, note } });
      return updated.coins;
    });
  }

  recentTransactions(take: number, userId?: string) {
    const where: Prisma.CoinTransactionWhereInput = userId ? { userId } : {};
    return this.prisma.coinTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, amount: true, reason: true, chapterId: true, actorId: true, note: true, createdAt: true, user: { select: { username: true } } },
    });
  }
}
