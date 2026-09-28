import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AttachmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActor(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: { id: true, isBanned: true, bannedUntil: true, mutedUntil: true } });
  }

  /** Pictures this account has uploaded since `since`, and how many of those still wait for a comment or message to join. */
  async countUploads(userId: string, since: Date): Promise<{ total: number; waiting: number }> {
    const [total, waiting] = await Promise.all([
      this.prisma.attachment.count({ where: { userId, createdAt: { gte: since } } }),
      this.prisma.attachment.count({ where: { userId, commentId: null, messageId: null, createdAt: { gte: since } } }),
    ]);
    return { total, waiting };
  }

  create(data: { userId: string; width: number; height: number; full: Buffer; thumb: Buffer }) {
    return this.prisma.attachment.create({
      data: { userId: data.userId, width: data.width, height: data.height, blob: { create: { data: data.full, thumb: data.thumb } } },
      select: { id: true, width: true, height: true },
    });
  }

  /** What is needed to decide whether these can join a comment or message: whose they are, whether they are taken, how old. */
  findMany(ids: string[]) {
    return this.prisma.attachment.findMany({
      where: { id: { in: ids } },
      select: { id: true, userId: true, commentId: true, messageId: true, createdAt: true, width: true, height: true },
      orderBy: { createdAt: "asc" },
    });
  }

  /** One picture with its bytes and where it belongs, for showing it. */
  findForServing(id: string) {
    return this.prisma.attachment.findUnique({
      where: { id },
      select: {
        userId: true,
        commentId: true,
        messageId: true,
        blob: { select: { data: true, thumb: true } },
        comment: { select: { deletedAt: true } },
        message: { select: { conversationId: true } },
      },
    });
  }

  async isMember(conversationId: string, userId: string): Promise<boolean> {
    return (await this.prisma.conversationMember.count({ where: { conversationId, userId } })) > 0;
  }
}
