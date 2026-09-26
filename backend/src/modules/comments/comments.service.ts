import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { RequestContext } from "../../common/middleware/request-context.middleware";
import { MODERATOR_ROLES, rankOf } from "../../common/roles";
import { activeMutedUntil, isEffectivelyBanned, isMuted } from "../moderation/moderation.util";
import { NotificationsService } from "../notifications/notifications.service";
import { ProgressService } from "../progress/progress.service";
import { cleanCommentText } from "./comment-text.util";
import { MAX_COMMENT_LENGTH, type CreateCommentDto, type UpdateCommentDto } from "./dto/comment.dto";
import { CommentsRepository } from "./comments.repository";

const LIST_LIMIT = 300;
const LATEST_MAX = 30;
const QUEUE_LIMIT = 100;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
/** Per account, so a spammer can't hide behind the shared proxy IP the per-IP throttler sees. */
const MAX_PER_MINUTE = 5;
const MAX_PER_HOUR = 60;
const DUPLICATE_WINDOW_MS = 5 * MINUTE_MS;

type Reaction = "like" | "dislike";

interface AuthorRow {
  id: string;
  username: string;
  displayName: string | null;
  role: string;
  updatedAt: Date;
  avatarMimeType: string | null;
}

interface CommentRow {
  id: string;
  seriesId: string;
  userId: string;
  content: string;
  isSpoiler: boolean;
  isPinned: boolean;
  createdAt: Date;
  editedAt: Date | null;
  user: AuthorRow;
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly repo: CommentsRepository,
    private readonly notifications: NotificationsService,
    private readonly progress: ProgressService
  ) {}

  async listForSeries(seriesId: string, viewerId: string | undefined) {
    const rows = await this.repo.listForSeries(seriesId, LIST_LIMIT);
    return { comments: await this.toDtos(rows, viewerId) };
  }

  async latest(limit: number) {
    const rows = await this.repo.listLatest(Math.min(Math.max(limit, 1), LATEST_MAX));
    return { comments: await this.toDtos(rows, undefined) };
  }

  async create(userId: string, dto: CreateCommentDto) {
    const author = await this.requireActiveMember(userId);
    if (isMuted(author)) {
      throw new ForbiddenException({
        code: "account_muted",
        message: `You are in a timeout until ${activeMutedUntil(author)}.`,
      });
    }

    const content = this.validContent(dto.content);
    const now = Date.now();

    if ((await this.repo.countByAuthorSince(userId, new Date(now - MINUTE_MS))) >= MAX_PER_MINUTE) {
      throw new HttpException({ code: "comment_rate_limited", message: "You are commenting too fast." }, HttpStatus.TOO_MANY_REQUESTS);
    }
    if ((await this.repo.countByAuthorSince(userId, new Date(now - HOUR_MS))) >= MAX_PER_HOUR) {
      throw new HttpException({ code: "comment_rate_limited", message: "Comment limit reached for this hour." }, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (await this.repo.findRecentDuplicate(userId, dto.seriesId, content, new Date(now - DUPLICATE_WINDOW_MS))) {
      throw new ConflictException({ code: "duplicate_comment", message: "You already posted this comment." });
    }

    const row = await this.repo.create({ seriesId: dto.seriesId, userId, content, isSpoiler: dto.isSpoiler ?? false });
    await this.progress.awardComment(userId); // experience for the comment; never fails the comment itself
    return (await this.toDtos([row], userId))[0];
  }

  /**
   * Field by field, because the rule differs: the text is the author's alone
   * (and a timed-out author can't rewrite it — that would be posting through the
   * back door); the spoiler flag is the author's or staff's; pinning is staff's.
   */
  async update(actorId: string, id: string, dto: UpdateCommentDto) {
    const actor = await this.requireActiveMember(actorId);
    const comment = await this.requireVisible(id);
    const isAuthor = comment.userId === actor.id;
    const isStaff = MODERATOR_ROLES.has(actor.role);

    const patch: { content?: string; isSpoiler?: boolean; isPinned?: boolean; editedAt?: Date } = {};

    if (dto.content !== undefined) {
      if (!isAuthor) throw new ForbiddenException({ code: "not_comment_author", message: "Only the author can edit a comment." });
      if (isMuted(actor)) {
        throw new ForbiddenException({ code: "account_muted", message: `You are in a timeout until ${activeMutedUntil(actor)}.` });
      }
      const content = this.validContent(dto.content);
      if (content !== comment.content) {
        patch.content = content;
        patch.editedAt = new Date();
      }
    }
    if (dto.isSpoiler !== undefined) {
      if (!isAuthor && !isStaff) throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot change this comment." });
      patch.isSpoiler = dto.isSpoiler;
    }
    if (dto.isPinned !== undefined) {
      if (!isStaff) throw new ForbiddenException({ code: "insufficient_permissions", message: "Only staff can pin comments." });
      patch.isPinned = dto.isPinned;
    }
    if (Object.keys(patch).length === 0) return (await this.toDtos([comment], actorId))[0];

    const row = await this.repo.update(id, patch);
    return (await this.toDtos([row], actorId))[0];
  }

  /** The author removes their own comment for good; staff remove someone else's softly (kept for review) and the author is told. */
  async remove(actorId: string, id: string, ctx: RequestContext): Promise<void> {
    const actor = await this.requireActiveMember(actorId);
    const comment = await this.requireVisible(id);

    if (comment.userId === actor.id) {
      await this.repo.hardDelete(id);
      return;
    }
    if (!MODERATOR_ROLES.has(actor.role)) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot delete this comment." });
    }
    if (rankOf(comment.user.role) > rankOf(actor.role)) {
      throw new ForbiddenException({ code: "cannot_moderate_higher_rank", message: "You cannot remove a higher-ranked member's comment." });
    }

    await this.repo.softDelete(id, actor.id);
    await this.repo.writeAuditLog({ actorId: actor.id, action: "comment.removed", target: `${comment.userId}:${id}`, ip: ctx.ip });
    await this.notifications.notify(
      comment.userId,
      "moderation",
      "تم حذف أحد تعليقاتك",
      "حذفت الإدارة تعليقاً لك لمخالفته الشروط.",
      "/terms"
    );
  }

  async react(userId: string, id: string, kind: string) {
    await this.requireActiveMember(userId);
    const comment = await this.requireVisible(id);
    if (comment.userId === userId) {
      throw new BadRequestException({ code: "cannot_react_own", message: "You cannot react to your own comment." });
    }
    if (kind === "none") await this.repo.clearReaction(id, userId);
    else await this.repo.setReaction(id, userId, kind);

    const [dto] = await this.toDtos([comment], userId);
    return { likes: dto.likes, dislikes: dto.dislikes, myReaction: dto.myReaction };
  }

  async report(userId: string, id: string, reason: string): Promise<void> {
    await this.requireActiveMember(userId);
    const comment = await this.requireVisible(id);
    if (comment.userId === userId) {
      throw new BadRequestException({ code: "cannot_report_own", message: "You cannot report your own comment." });
    }
    await this.repo.upsertReport(id, userId, reason.trim());
  }

  async reportQueue(actorId: string) {
    await this.requireStaff(actorId);
    const rows = await this.repo.reportedComments(QUEUE_LIMIT);
    const dtos = await this.toDtos(rows, undefined);
    return {
      items: rows.map((row, i) => ({
        comment: dtos[i],
        reports: row.reports.map((r) => ({ reporter: r.reporter.username, reason: r.reason, createdAt: r.createdAt })),
      })),
    };
  }

  async dismissReports(actorId: string, id: string, ctx: RequestContext): Promise<void> {
    const actor = await this.requireStaff(actorId);
    await this.requireVisible(id);
    await this.repo.dismissReports(id);
    await this.repo.writeAuditLog({ actorId: actor.id, action: "comment.reports_dismissed", target: id, ip: ctx.ip });
  }

  private validContent(raw: string): string {
    const content = cleanCommentText(raw);
    if (content === null) throw new BadRequestException({ code: "empty_comment", message: "A comment can't be empty." });
    if (content.length > MAX_COMMENT_LENGTH) {
      throw new BadRequestException({ code: "comment_too_long", message: `A comment can be at most ${MAX_COMMENT_LENGTH} characters.` });
    }
    return content;
  }

  private async requireActiveMember(userId: string) {
    const actor = await this.repo.findActor(userId);
    if (!actor) throw new NotFoundException({ code: "user_not_found", message: "Account no longer exists." });
    if (isEffectivelyBanned(actor)) throw new ForbiddenException({ code: "account_banned", message: "This account has been banned." });
    return actor;
  }

  private async requireStaff(userId: string) {
    const actor = await this.requireActiveMember(userId);
    if (!MODERATOR_ROLES.has(actor.role)) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot moderate comments." });
    }
    return actor;
  }

  private async requireVisible(id: string) {
    const comment = await this.repo.findById(id);
    if (!comment || comment.deletedAt) throw new NotFoundException({ code: "comment_not_found", message: "Comment not found." });
    return comment;
  }

  /** Attaches like/dislike counts and the viewer's own reaction with two queries for the whole batch, not two per comment. */
  private async toDtos(rows: CommentRow[], viewerId: string | undefined) {
    const ids = rows.map((r) => r.id);
    const [counts, mine] = await Promise.all([
      this.repo.reactionCounts(ids),
      viewerId ? this.repo.viewerReactions(viewerId, ids) : Promise.resolve([]),
    ]);

    const tally = new Map<string, { like: number; dislike: number }>();
    for (const c of counts) {
      const entry = tally.get(c.commentId) ?? { like: 0, dislike: 0 };
      if (c.kind === "like" || c.kind === "dislike") entry[c.kind] = c._count._all;
      tally.set(c.commentId, entry);
    }
    const mineByComment = new Map(mine.map((m) => [m.commentId, m.kind]));

    return rows.map((row) => {
      const t = tally.get(row.id);
      const my = mineByComment.get(row.id);
      return {
        id: row.id,
        seriesId: row.seriesId,
        content: row.content,
        isSpoiler: row.isSpoiler,
        isPinned: row.isPinned,
        createdAt: row.createdAt,
        editedAt: row.editedAt,
        likes: t?.like ?? 0,
        dislikes: t?.dislike ?? 0,
        myReaction: (my === "like" || my === "dislike" ? my : null) as Reaction | null,
        author: {
          id: row.user.id,
          username: row.user.username,
          displayName: row.user.displayName ?? row.user.username,
          role: row.user.role,
          avatarVersion: row.user.avatarMimeType ? row.user.updatedAt.toISOString() : null,
        },
      };
    });
  }
}
