import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const PERSON = { id: true, username: true, displayName: true, avatarMimeType: true, updatedAt: true } as const;

@Injectable()
export class MessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActor(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: { id: true, isBanned: true, bannedUntil: true, mutedUntil: true } });
  }

  /** Accounts that exist and are not banned, by id or by exact username. */
  findPeople(params: { ids?: string[]; usernames?: string[] }) {
    return this.prisma.user.findMany({
      where: {
        isBanned: false,
        OR: [...(params.ids?.length ? [{ id: { in: params.ids } }] : []), ...(params.usernames?.length ? [{ username: { in: params.usernames } }] : [])],
      },
      select: PERSON,
    });
  }

  findByPairKey(pairKey: string) {
    return this.prisma.conversation.findUnique({ where: { pairKey }, select: { id: true } });
  }

  createConversation(data: { title: string | null; isGroup: boolean; pairKey: string | null; createdById: string; memberIds: string[] }) {
    return this.prisma.conversation.create({
      data: {
        title: data.title,
        isGroup: data.isGroup,
        pairKey: data.pairKey,
        createdById: data.createdById,
        members: { create: data.memberIds.map((userId) => ({ userId })) },
      },
      select: { id: true },
    });
  }

  addMembers(conversationId: string, userIds: string[]) {
    return this.prisma.conversationMember.createMany({ data: userIds.map((userId) => ({ conversationId, userId })), skipDuplicates: true });
  }

  membership(conversationId: string, userId: string) {
    return this.prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
  }

  /** One conversation with its members and its newest message. */
  findConversation(id: string) {
    return this.prisma.conversation.findUnique({
      where: { id },
      include: {
        members: { include: { user: { select: PERSON } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
  }

  /** The member's conversations, most recently active first. */
  listFor(userId: string, take: number) {
    return this.prisma.conversation.findMany({
      where: { members: { some: { userId } } },
      orderBy: { lastMessageAt: "desc" },
      take,
      include: {
        members: { include: { user: { select: PERSON } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
  }

  /** Unread messages per conversation: sent by someone else after the member last read. */
  async unreadByConversation(userId: string): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<{ conversationId: string; unread: bigint }[]>`
      SELECT m."conversationId", COUNT(*) AS unread
      FROM "messages" m
      JOIN "conversation_members" cm ON cm."conversationId" = m."conversationId" AND cm."userId" = ${userId}
      WHERE m."createdAt" > cm."lastReadAt" AND (m."senderId" IS NULL OR m."senderId" <> ${userId})
      GROUP BY m."conversationId"`;
    return new Map(rows.map((r) => [r.conversationId, Number(r.unread)]));
  }

  listMessages(conversationId: string, params: { before?: Date; take: number }) {
    return this.prisma.message.findMany({
      where: { conversationId, ...(params.before ? { createdAt: { lt: params.before } } : {}) },
      orderBy: { createdAt: "desc" },
      take: params.take,
    });
  }

  async createMessage(data: { conversationId: string; senderId: string; text: string }) {
    const now = new Date();
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({ data: { ...data, createdAt: now } }),
      this.prisma.conversation.update({ where: { id: data.conversationId }, data: { lastMessageAt: now } }),
      // The sender has, by definition, read everything up to their own message.
      this.prisma.conversationMember.update({ where: { conversationId_userId: { conversationId: data.conversationId, userId: data.senderId } }, data: { lastReadAt: now } }),
    ]);
    return message;
  }

  markRead(conversationId: string, userId: string) {
    return this.prisma.conversationMember.update({ where: { conversationId_userId: { conversationId, userId } }, data: { lastReadAt: new Date() } });
  }

  async leave(conversationId: string, userId: string) {
    await this.prisma.conversationMember.delete({ where: { conversationId_userId: { conversationId, userId } } });
    if ((await this.prisma.conversationMember.count({ where: { conversationId } })) === 0) {
      await this.prisma.conversation.delete({ where: { id: conversationId } });
    }
  }
}
