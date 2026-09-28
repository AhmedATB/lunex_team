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

/** The picture that goes with a comment (its bytes stay in their own table; only what is needed to ask for it is loaded). */
const WITH_IMAGE = { attachments: { select: { id: true, width: true, height: true }, orderBy: { createdAt: "asc" as const } } };

@Injectable()
export class CommentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActor(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, isBanned: true, bannedUntil: true, mutedUntil: true },
    });
  }

  /** The top-level comments of a work — or of one of its chapters (replies are fetched for these, below). */
  listForSeries(seriesId: string, take: number, chapterId?: string) {
    return this.prisma.comment.findMany({
      where: { seriesId, parentId: null, ...(chapterId ? { chapterId } : {}), ...visible },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take,
      include: { user: { select: AUTHOR_SELECT }, ...WITH_IMAGE },
    });
  }

  /** The replies under these top-level comments, oldest first (a conversation reads downwards). */
  listReplies(parentIds: string[], take: number) {
    if (parentIds.length === 0) return Promise.resolve([]);
    return this.prisma.comment.findMany({
      where: { parentId: { in: parentIds }, ...visible },
      orderBy: { createdAt: "asc" },
      take,
      include: { user: { select: AUTHOR_SELECT }, ...WITH_IMAGE },
    });
  }

  /** A published chapter, to check a comment written under it really belongs to it. */
  findPublishedChapter(id: string) {
    return this.prisma.chapter.findFirst({ where: { id, isPublished: true }, select: { id: true, seriesId: true, number: true } });
  }

  /** The address of a work's page, for a link in a notification. */
  async seriesSlug(seriesId: string): Promise<string | null> {
    return (await this.prisma.series.findUnique({ where: { id: seriesId }, select: { slug: true } }))?.slug ?? null;
  }

  listLatest(take: number) {
    return this.prisma.comment.findMany({
      where: visible,
      orderBy: { createdAt: "desc" },
      take,
      include: { user: { select: AUTHOR_SELECT }, ...WITH_IMAGE },
    });
  }

  /** Every comment on the site, newest first, for the staff's moderation list (optionally only those reported, and only older than `before`). */
  listForStaff(params: { take: number; before?: Date; reportedOnly: boolean }) {
    return this.prisma.comment.findMany({
      where: {
        ...visible,
        ...(params.before ? { createdAt: { lt: params.before } } : {}),
        ...(params.reportedOnly ? { reports: { some: {} } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: params.take,
      include: { user: { select: AUTHOR_SELECT }, ...WITH_IMAGE, _count: { select: { reports: true } } },
    });
  }

  findById(id: string) {
    return this.prisma.comment.findUnique({ where: { id }, include: { user: { select: AUTHOR_SELECT }, ...WITH_IMAGE } });
  }

  countByAuthorSince(userId: string, since: Date) {
    return this.prisma.comment.count({ where: { userId, createdAt: { gte: since } } });
  }

  /** The same words from the same person in the same place (the same chapter and thread) a moment ago. */
  findRecentDuplicate(userId: string, seriesId: string, content: string, since: Date, parentId: string | null, chapterId: string | null) {
    return this.prisma.comment.findFirst({
      where: { userId, seriesId, parentId, chapterId, content, createdAt: { gte: since }, ...visible },
      select: { id: true },
    });
  }

  create(data: { seriesId: string; userId: string; content: string; isSpoiler: boolean; parentId?: string; chapterId?: string; chapterNumber?: number; attachmentIds?: string[] }) {
    const { attachmentIds, ...fields } = data;
    return this.prisma.comment.create({
      data: { ...fields, ...(attachmentIds?.length ? { attachments: { connect: attachmentIds.map((id) => ({ id })) } } : {}) },
      include: { user: { select: AUTHOR_SELECT }, ...WITH_IMAGE },
    });
  }

  update(id: string, data: { content?: string; isSpoiler?: boolean; isPinned?: boolean; editedAt?: Date }) {
    return this.prisma.comment.update({ where: { id }, data, include: { user: { select: AUTHOR_SELECT }, ...WITH_IMAGE } });
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
        ...WITH_IMAGE,
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
