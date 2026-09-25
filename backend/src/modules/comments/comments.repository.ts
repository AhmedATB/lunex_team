import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/** What a comment row needs from its author to be shown — never the email, never the avatar bytes. */
const AUTHOR_SELECT = {
  id: true,
  username: true,
  displayName: true,
  role: true,
  updatedAt: true,
  avatarMimeType: true,
} as const;

const visible = { deletedAt: null };

@Injectable()
export class CommentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActor(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, isBanned: true, bannedUntil: true, mutedUntil: true },
    });
  }

  listForSeries(seriesId: string, take: number) {
    return this.prisma.comment.findMany({
      where: { seriesId, ...visible },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take,
      include: { user: { select: AUTHOR_SELECT } },
    });
  }

  listLatest(take: number) {
    return this.prisma.comment.findMany({
      where: visible,
      orderBy: { createdAt: "desc" },
      take,
      include: { user: { select: AUTHOR_SELECT } },
    });
  }

  findById(id: string) {
    return this.prisma.comment.findUnique({ where: { id }, include: { user: { select: AUTHOR_SELECT } } });
  }

  countByAuthorSince(userId: string, since: Date) {
    return this.prisma.comment.count({ where: { userId, createdAt: { gte: since } } });
  }

  findRecentDuplicate(userId: string, seriesId: string, content: string, since: Date) {
    return this.prisma.comment.findFirst({
      where: { userId, seriesId, content, createdAt: { gte: since }, ...visible },
      select: { id: true },
    });
  }

  create(data: { seriesId: string; userId: string; content: string; isSpoiler: boolean }) {
    return this.prisma.comment.create({ data, include: { user: { select: AUTHOR_SELECT } } });
  }

  update(id: string, data: { content?: string; isSpoiler?: boolean; isPinned?: boolean; editedAt?: Date }) {
    return this.prisma.comment.update({ where: { id }, data, include: { user: { select: AUTHOR_SELECT } } });
  }

  /** The author deleting their own comment: gone for good. */
  hardDelete(id: string) {
    return this.prisma.comment.delete({ where: { id } });
  }

  /** A moderator's removal: hidden from every list but kept (with who removed it) until RetentionService purges it. */
  softDelete(id: string, deletedById: string) {
    return this.prisma.comment.update({ where: { id }, data: { deletedAt: new Date(), deletedById } });
  }

  /** Like/dislike counts for a batch of comments in one query. */
  async reactionCounts(commentIds: string[]) {
    if (commentIds.length === 0) return [];
    return this.prisma.commentReaction.groupBy({
      by: ["commentId", "kind"],
      where: { commentId: { in: commentIds } },
      _count: { _all: true },
    });
  }

  viewerReactions(userId: string, commentIds: string[]) {
    if (commentIds.length === 0) return Promise.resolve([]);
    return this.prisma.commentReaction.findMany({
      where: { userId, commentId: { in: commentIds } },
      select: { commentId: true, kind: true },
    });
  }

  setReaction(commentId: string, userId: string, kind: string) {
    return this.prisma.commentReaction.upsert({
      where: { commentId_userId: { commentId, userId } },
      update: { kind },
      create: { commentId, userId, kind },
    });
  }

  clearReaction(commentId: string, userId: string) {
    return this.prisma.commentReaction.deleteMany({ where: { commentId, userId } });
  }

  upsertReport(commentId: string, reporterId: string, reason: string) {
    return this.prisma.commentReport.upsert({
      where: { commentId_reporterId: { commentId, reporterId } },
      update: { reason },
      create: { commentId, reporterId, reason },
    });
  }

  dismissReports(commentId: string) {
    return this.prisma.commentReport.deleteMany({ where: { commentId } });
  }

  /** Comments with at least one open report, most-reported first — the staff queue. */
  reportedComments(take: number) {
    return this.prisma.comment.findMany({
      where: { ...visible, reports: { some: {} } },
      include: {
        user: { select: AUTHOR_SELECT },
        reports: { orderBy: { createdAt: "desc" }, include: { reporter: { select: { username: true } } } },
      },
      orderBy: { reports: { _count: "desc" } },
      take,
    });
  }

  writeAuditLog(params: { actorId?: string; action: string; target?: string; ip?: string }) {
    return this.prisma.auditLog.create({ data: params });
  }
}
