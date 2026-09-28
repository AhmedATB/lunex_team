import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export const PUSH_CATEGORIES = ["chapters", "messages", "replies", "news", "account"] as const;
export type PushCategory = (typeof PUSH_CATEGORIES)[number];
export type PushPreferences = Record<PushCategory, boolean>;

export interface StoredSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

const ALL_ON: PushPreferences = { chapters: true, messages: true, replies: true, news: true, account: true };
const SUBSCRIPTION = { id: true, userId: true, endpoint: true, p256dh: true, auth: true } as const;

@Injectable()
export class PushRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---- the site's own keys ------------------------------------------------------

  async getSetting(key: string): Promise<string | null> {
    return (await this.prisma.siteSetting.findUnique({ where: { key }, select: { value: true } }))?.value ?? null;
  }

  /** Stores a setting only if it is not there yet (two instances starting together must not each write their own keys). */
  async setSettingIfMissing(key: string, value: string): Promise<void> {
    await this.prisma.siteSetting.createMany({ data: [{ key, value }], skipDuplicates: true });
  }

  // ---- devices ---------------------------------------------------------------------

  /** A device belongs to whoever is signed in on it now: subscribing again from the same browser moves it to that account. */
  upsertSubscription(data: { userId: string; endpoint: string; p256dh: string; auth: string; userAgent: string | null }) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: data.endpoint },
      update: { userId: data.userId, p256dh: data.p256dh, auth: data.auth, userAgent: data.userAgent },
      create: data,
      select: { id: true },
    });
  }

  deleteSubscription(userId: string, endpoint: string) {
    return this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  deleteSubscriptionById(id: string) {
    return this.prisma.pushSubscription.deleteMany({ where: { id } });
  }

  countSubscriptions(userId: string) {
    return this.prisma.pushSubscription.count({ where: { userId } });
  }

  hasSubscription(userId: string, endpoint: string) {
    return this.prisma.pushSubscription.count({ where: { userId, endpoint } }).then((n) => n > 0);
  }

  subscriptionsFor(userIds: string[]): Promise<StoredSubscription[]> {
    if (userIds.length === 0) return Promise.resolve([]);
    return this.prisma.pushSubscription.findMany({ where: { userId: { in: userIds } }, select: SUBSCRIPTION });
  }

  /** Every device, a page after `after` (an id), for a broadcast. */
  subscriptionsPage(after: string | null, take: number): Promise<StoredSubscription[]> {
    return this.prisma.pushSubscription.findMany({ where: after ? { id: { gt: after } } : {}, orderBy: { id: "asc" }, take, select: SUBSCRIPTION });
  }

  // ---- what each account wants -------------------------------------------------------

  async preferencesFor(userIds: string[]): Promise<Map<string, PushPreferences>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.prisma.pushPreference.findMany({ where: { userId: { in: userIds } } });
    return new Map(rows.map((r) => [r.userId, { chapters: r.chapters, messages: r.messages, replies: r.replies, news: r.news, account: r.account }]));
  }

  async getPreferences(userId: string): Promise<PushPreferences> {
    return (await this.preferencesFor([userId])).get(userId) ?? { ...ALL_ON };
  }

  async savePreferences(userId: string, prefs: Partial<PushPreferences>): Promise<PushPreferences> {
    await this.prisma.pushPreference.upsert({ where: { userId }, update: prefs, create: { userId, ...prefs } });
    return this.getPreferences(userId);
  }

  // ---- who to tell -------------------------------------------------------------------

  /** Accounts that have the work in their library (its favourites), and are not banned. */
  async libraryReaderIds(seriesId: string): Promise<string[]> {
    const rows = await this.prisma.bookmark.findMany({ where: { seriesId, user: { isBanned: false } }, select: { userId: true } });
    return rows.map((r) => r.userId);
  }

  /** The people of a chat besides the sender, the chat's name, and the sender's name — for the words of a notification. */
  async chatContext(conversationId: string, senderId: string) {
    const [conversation, sender] = await Promise.all([
      this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { title: true, isGroup: true, members: { select: { userId: true } } } }),
      this.prisma.user.findUnique({ where: { id: senderId }, select: { displayName: true, username: true } }),
    ]);
    if (!conversation) return null;
    return {
      isGroup: conversation.isGroup,
      title: conversation.title,
      recipientIds: conversation.members.map((m) => m.userId).filter((id) => id !== senderId),
      senderName: sender?.displayName ?? sender?.username ?? "",
    };
  }
}
