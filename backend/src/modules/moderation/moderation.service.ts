import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { RequestContext } from "../../common/middleware/request-context.middleware";
import { BAN_ROLES, MODERATOR_ROLES, rankOf } from "../../common/roles";
import { NotificationsService } from "../notifications/notifications.service";
import type { CreateSanctionDto } from "./dto/create-sanction.dto";
import { ModerationRepository } from "./moderation.repository";
import { activeBannedUntil, activeMutedUntil, isEffectivelyBanned, type SanctionType } from "./moderation.util";

const HOUR_MS = 60 * 60 * 1000;
/** Moderators may time someone out for at most this long; longer punishments belong to the administrators. */
const MODERATOR_MAX_TIMEOUT_HOURS = 24 * 30;
const HISTORY_LIMIT = 100;

interface Actor {
  id: string;
  username: string;
  role: string;
}

/** "3 ساعات" / "5 أيام" — the notification is read by the person, not a machine. */
function describeDuration(hours: number): string {
  if (hours < 24) return hours === 1 ? "ساعة واحدة" : hours === 2 ? "ساعتان" : `${hours} ${hours <= 10 ? "ساعات" : "ساعة"}`;
  const days = Math.round(hours / 24);
  return days === 1 ? "يوم واحد" : days === 2 ? "يومان" : `${days} ${days <= 10 ? "أيام" : "يوماً"}`;
}

@Injectable()
export class ModerationService {
  constructor(
    private readonly repo: ModerationRepository,
    private readonly notifications: NotificationsService
  ) {}

  /**
   * Who may do what, enforced here (the admin UI hiding a button is UX, not
   * security):
   *  - warn / time out: moderators and above; a moderator's timeout is capped;
   *  - ban: owner and super_administrator only;
   *  - nobody sanctions themselves, an owner, or anyone of equal or higher rank.
   */
  async applySanction(actorId: string, targetId: string, dto: CreateSanctionDto, ctx: RequestContext) {
    const actor = await this.requireModerator(actorId);
    const target = await this.requireTarget(actor, targetId);
    const type = dto.type as SanctionType;

    if (type === "ban" && !BAN_ROLES.has(actor.role)) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot ban users." });
    }
    if (type === "warning" && dto.durationHours !== undefined) {
      throw new BadRequestException({ code: "invalid_duration", message: "A warning has no duration." });
    }
    if (type === "timeout" && dto.durationHours === undefined) {
      throw new BadRequestException({ code: "duration_required", message: "A timeout needs a duration." });
    }
    if (type === "timeout" && actor.role === "moderator" && (dto.durationHours ?? 0) > MODERATOR_MAX_TIMEOUT_HOURS) {
      throw new ForbiddenException({
        code: "duration_too_long",
        message: "Moderators can time someone out for at most 30 days.",
      });
    }
    if (type === "ban" && isEffectivelyBanned(target)) {
      throw new ConflictException({ code: "already_banned", message: "This account is already banned. Lift the ban first." });
    }

    const reason = dto.reason.trim();
    const expiresAt = dto.durationHours === undefined ? null : new Date(Date.now() + dto.durationHours * HOUR_MS);

    let sanction;
    if (type === "warning") {
      sanction = await this.repo.createWarning({ userId: target.id, reason, createdById: actor.id });
    } else if (type === "timeout" && expiresAt) {
      sanction = await this.repo.createTimeout({ userId: target.id, reason, createdById: actor.id, expiresAt });
    } else {
      sanction = await this.repo.createBan({ userId: target.id, reason, createdById: actor.id, expiresAt });
    }

    await this.repo.writeAuditLog({
      actorId: actor.id,
      action: `moderation.${type}`,
      target: `${target.id}:${sanction.id}`,
      ip: ctx.ip,
    });
    await this.notify(target.id, type, reason, dto.durationHours);

    return this.toPublicSanction(sanction, new Map([[actor.id, actor.username]]));
  }

  async revokeSanction(actorId: string, targetId: string, sanctionId: string, ctx: RequestContext) {
    const actor = await this.requireModerator(actorId);
    const target = await this.requireTarget(actor, targetId);

    const sanction = await this.repo.findSanction(sanctionId);
    if (!sanction || sanction.userId !== target.id) {
      throw new NotFoundException({ code: "sanction_not_found", message: "Sanction not found." });
    }
    const now = new Date();
    if (sanction.revokedAt || (sanction.expiresAt !== null && sanction.expiresAt <= now)) {
      throw new ConflictException({ code: "sanction_not_active", message: "This sanction is no longer in effect." });
    }

    if (sanction.type === "ban") {
      if (!BAN_ROLES.has(actor.role)) {
        throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot lift bans." });
      }
      await this.repo.liftBan(target.id, actor.id);
    } else if (sanction.type === "timeout") {
      await this.repo.liftTimeout(target.id, actor.id);
    } else {
      await this.repo.retractWarning(sanction.id, actor.id);
    }

    await this.repo.writeAuditLog({
      actorId: actor.id,
      action: `moderation.${sanction.type}_lifted`,
      target: `${target.id}:${sanction.id}`,
      ip: ctx.ip,
    });
    await this.notifications.notify(
      target.id,
      "moderation",
      "تم رفع العقوبة",
      sanction.type === "warning" ? "سحبت الإدارة التحذير الموجّه إليك." : "رفعت الإدارة العقوبة عن حسابك."
    );
  }

  /**
   * Lifts a ban by user id rather than by sanction id — what the older
   * "unban" toggle needs. Also clears bans that predate sanction records.
   */
  async liftBan(actorId: string, targetId: string, ctx: RequestContext) {
    const actor = await this.requireModerator(actorId);
    if (!BAN_ROLES.has(actor.role)) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot lift bans." });
    }
    const target = await this.requireTarget(actor, targetId);
    await this.repo.liftBan(target.id, actor.id);
    await this.repo.writeAuditLog({ actorId: actor.id, action: "moderation.ban_lifted", target: target.id, ip: ctx.ip });
  }

  /** The account's current state plus its full sanction history — staff only. */
  async listForUser(actorId: string, targetId: string) {
    const actor = await this.requireModerator(actorId);
    const target = await this.repo.findUser(targetId);
    if (!target) {
      throw new NotFoundException({ code: "user_not_found", message: "User not found." });
    }
    const rows = await this.repo.listSanctions(target.id, HISTORY_LIMIT);
    const usernames = await this.repo.findUsernames([
      ...new Set(rows.flatMap((r) => [r.createdById, r.revokedById]).filter((id): id is string => Boolean(id))),
    ]);
    const now = new Date();
    return {
      user: {
        id: target.id,
        username: target.username,
        role: target.role,
        isBanned: isEffectivelyBanned(target, now),
        bannedUntil: activeBannedUntil(target, now),
        mutedUntil: activeMutedUntil(target, now),
      },
      /** What THIS staff member may do to this account — the UI shows only these. */
      canSanction: this.canSanctionRank(actor, target.role, target.id),
      canBan: BAN_ROLES.has(actor.role),
      sanctions: rows.map((r) => this.toPublicSanction(r, usernames)),
    };
  }

  private canSanctionRank(actor: Actor, targetRole: string, targetId: string): boolean {
    return targetId !== actor.id && targetRole !== "owner" && rankOf(targetRole) < rankOf(actor.role);
  }

  private async requireModerator(actorId: string): Promise<Actor> {
    const actor = await this.repo.findUser(actorId);
    if (!actor || !MODERATOR_ROLES.has(actor.role)) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot moderate users." });
    }
    return { id: actor.id, username: actor.username, role: actor.role };
  }

  private async requireTarget(actor: Actor, targetId: string) {
    if (targetId === actor.id) {
      throw new ForbiddenException({ code: "cannot_sanction_self", message: "You cannot sanction your own account." });
    }
    const target = await this.repo.findUser(targetId);
    if (!target) {
      throw new NotFoundException({ code: "user_not_found", message: "User not found." });
    }
    if (target.role === "owner") {
      throw new ForbiddenException({ code: "cannot_sanction_owner", message: "The owner account cannot be sanctioned." });
    }
    if (rankOf(target.role) >= rankOf(actor.role)) {
      throw new ForbiddenException({
        code: "cannot_sanction_equal_or_higher",
        message: "You cannot sanction someone of the same or a higher rank.",
      });
    }
    return target;
  }

  private notify(userId: string, type: SanctionType, reason: string, hours?: number) {
    if (type === "warning") {
      return this.notifications.notify(userId, "moderation", "تحذير من الإدارة", reason, "/terms");
    }
    if (type === "timeout") {
      return this.notifications.notify(
        userId,
        "moderation",
        "تم إيقاف تعليقك ومراسلتك مؤقتاً",
        `المدة: ${describeDuration(hours ?? 0)}. السبب: ${reason}`,
        "/terms"
      );
    }
    return this.notifications.notify(
      userId,
      "moderation",
      "تم حظر حسابك",
      `${hours === undefined ? "الحظر دائم" : `مدة الحظر: ${describeDuration(hours)}`}. السبب: ${reason}`,
      "/terms"
    );
  }

  private toPublicSanction(
    s: {
      id: string;
      type: string;
      reason: string;
      createdById: string | null;
      createdAt: Date;
      expiresAt: Date | null;
      revokedAt: Date | null;
      revokedById: string | null;
    },
    usernames: Map<string, string>
  ) {
    const now = new Date();
    return {
      id: s.id,
      type: s.type,
      reason: s.reason,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      revokedAt: s.revokedAt,
      createdBy: s.createdById ? (usernames.get(s.createdById) ?? null) : null,
      revokedBy: s.revokedById ? (usernames.get(s.revokedById) ?? null) : null,
      /** A warning stays "active" until retracted; a timeout or ban until it expires or is lifted. */
      active: !s.revokedAt && (s.expiresAt === null || s.expiresAt > now),
    };
  }
}
