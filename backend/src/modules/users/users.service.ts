import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import sharp from "sharp";
import type { RequestContext } from "../../common/middleware/request-context.middleware";
import { verifyPassword } from "../auth/crypto/password.util";
import { ModerationService } from "../moderation/moderation.service";
import { activeMutedUntil, isEffectivelyBanned } from "../moderation/moderation.util";
import { NotificationsService } from "../notifications/notifications.service";
import { UsersRepository } from "./users.repository";
import { isReservedDisplayName, isReservedUsername } from "./username.util";
import type { DeleteAccountDto } from "./dto/delete-account.dto";
import type { UpdateProfileDto } from "./dto/update-profile.dto";

const ROLE_MANAGER_ROLES = new Set(["owner", "super_administrator"]);
const ALLOWED_AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const AVATAR_SIZE_PX = 256;

/**
 * Mirrors the frontend's rbac.ts permission model (manage_users is granted
 * to owner/super_administrator only) — duplicated here deliberately, not
 * imported, since the two apps don't share a types package yet (see the
 * infra doc's packages/contracts note for the long-term fix). The frontend
 * hiding a button is UX, not security: this check is what actually stops an
 * authenticated-but-unprivileged user from calling the endpoint directly.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly notifications: NotificationsService,
    private readonly moderation: ModerationService
  ) {}

  async changeRole(actorId: string, targetUserId: string, newRole: string, ctx: RequestContext) {
    // Re-fetched from DB rather than trusted off the actor's JWT claim: a
    // role change should take effect immediately, not just once the actor's
    // current (possibly already-stale, up to 10 minutes old) access token
    // happens to expire.
    const actor = await this.repo.findById(actorId);
    if (!actor || !ROLE_MANAGER_ROLES.has(actor.role)) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot manage user roles." });
    }
    // Granting "owner" is reserved to existing owners — a super_administrator
    // promoting themselves (or anyone) straight to owner would be a
    // privilege escalation one level beyond what their own role permits.
    if (newRole === "owner" && actor.role !== "owner") {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "Only an owner can grant the owner role." });
    }

    const target = await this.repo.findById(targetUserId);
    if (!target) {
      throw new NotFoundException({ code: "user_not_found", message: "User not found." });
    }

    const updated = await this.repo.updateRole(targetUserId, newRole);
    await this.repo.writeAuditLog({
      actorId,
      action: "user.role_changed",
      target: `${targetUserId}:${target.role}->${newRole}`,
      ip: ctx.ip,
    });
    await this.notifications.notify(
      targetUserId,
      "account",
      "تم تحديث صلاحيتك",
      "تم تغيير دورك على المنصة — راجع صفحة حسابك للتفاصيل.",
      "/profile"
    );

    return { id: updated.id, email: updated.email, username: updated.username, role: updated.role };
  }

  /**
   * Bans (or lifts a ban on) an account. Same actor gate as changeRole, plus
   * two extra guards a role change doesn't need: an owner can't be banned
   * (by anyone, including another owner — losing the platform's own owner
   * account to a mistake or malicious super_administrator would be far
   * worse than any abuse a ban is meant to stop), and nobody can ban
   * themselves. Banning revokes every existing session so the ban takes
   * effect as soon as the account's current access token expires (see
   * AuthService.revokeAllSessionsForUser).
   */
  async setBanned(actorId: string, targetUserId: string, isBanned: boolean, ctx: RequestContext) {
    const actor = await this.repo.findById(actorId);
    if (!actor || !ROLE_MANAGER_ROLES.has(actor.role)) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot ban users." });
    }
    if (targetUserId === actorId) {
      throw new ForbiddenException({ code: "cannot_ban_self", message: "You cannot ban your own account." });
    }

    const target = await this.repo.findById(targetUserId);
    if (!target) {
      throw new NotFoundException({ code: "user_not_found", message: "User not found." });
    }
    if (target.role === "owner") {
      throw new ForbiddenException({ code: "cannot_ban_owner", message: "The owner account cannot be banned." });
    }

    // The record, the enforcement and the session revocation all live in ModerationService now, so this legacy
    // ban/unban toggle and the new sanctions API can never disagree about who is banned.
    if (isBanned) {
      await this.moderation.applySanction(actorId, targetUserId, { type: "ban", reason: "Banned by an administrator." }, ctx);
    } else {
      await this.moderation.liftBan(actorId, targetUserId, ctx);
    }

    return { id: target.id, isBanned };
  }

  /** The only reliable way to see every banned real account — the admin UI's own user list is otherwise limited to whatever it has locally cached (see mergeRealUsers). */
  async listBanned(actorId: string) {
    const actor = await this.repo.findById(actorId);
    if (!actor || !ROLE_MANAGER_ROLES.has(actor.role)) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot view banned users." });
    }
    const banned = await this.repo.listBanned();
    return banned.map((u) => this.toPublic(u));
  }

  /** Self-service — a user editing their own username/displayName/bio. Username uniqueness is pre-checked (matches AuthService.register's approach) rather than caught as a DB constraint error. */
  async updateProfile(userId: string, dto: UpdateProfileDto, ctx: RequestContext) {
    // Only a name that actually changes is checked, so saving other fields never trips over an account's existing name.
    const current = dto.username || dto.displayName ? await this.repo.findById(userId) : null;
    // Reserved names are how the team holds its own handles; the people who run the site may take them.
    const mayTakeReserved = current !== null && ROLE_MANAGER_ROLES.has(current.role);
    if (dto.displayName && dto.displayName !== current?.displayName && !mayTakeReserved && isReservedDisplayName(dto.displayName)) {
      throw new ConflictException({ code: "display_name_reserved", message: "This display name is not available." });
    }
    if (dto.username && dto.username !== current?.username) {
      if (!mayTakeReserved && isReservedUsername(dto.username)) {
        throw new ConflictException({ code: "username_reserved", message: "This username is not available." });
      }
      // A look-alike of the account's own name (a different case, say) is fine; anyone else's is not.
      const holders = await Promise.all([this.repo.findByUsername(dto.username), this.repo.findByUsernameKey(dto.username)]);
      if (holders.some((holder) => holder && holder.id !== userId)) {
        throw new ConflictException({ code: "username_taken", message: "This username is already taken." });
      }
    }

    const updated = await this.repo.updateProfile(userId, {
      username: dto.username,
      displayName: dto.displayName,
      bio: dto.bio,
    });
    await this.repo.writeAuditLog({ actorId: userId, action: "user.profile_updated", ip: ctx.ip });

    return this.toPublic(updated);
  }

  /**
   * Resized/re-encoded before it ever reaches the DB — never trust the
   * caller's own claimed size/dimensions, and never store the original
   * upload as-is (an attacker-controlled multi-megapixel file sitting in a
   * Bytes column is its own kind of abuse vector).
   */
  async uploadAvatar(userId: string, file: Express.Multer.File | undefined, ctx: RequestContext) {
    if (!file) {
      throw new BadRequestException({ code: "missing_file", message: "No image file was uploaded." });
    }
    if (!ALLOWED_AVATAR_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException({ code: "unsupported_image_type", message: "Please upload a JPEG, PNG, WebP, or GIF image." });
    }

    let resized: Buffer;
    try {
      resized = await sharp(file.buffer)
        .resize(AVATAR_SIZE_PX, AVATAR_SIZE_PX, { fit: "cover" })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      throw new BadRequestException({ code: "invalid_image", message: "This file could not be read as an image." });
    }

    const updated = await this.repo.updateAvatar(userId, resized, "image/webp");
    await this.repo.writeAuditLog({ actorId: userId, action: "user.avatar_updated", ip: ctx.ip });

    return this.toPublic(updated);
  }

  /**
   * Self-service, irreversible. The account's own credentials are re-checked
   * (a stolen-but-still-logged-in session must not be enough to erase someone
   * else's account), and the platform owner is refused — losing the only
   * owner to one click would leave nobody able to grant the role again, so
   * ownership has to be handed over first (same reasoning as cannot_ban_owner).
   *
   * Sessions are deleted along with the row (schema cascade), so every
   * refresh token dies with it; an access token already in flight simply
   * stops resolving to a user within its 10-minute lifetime.
   */
  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw new NotFoundException({ code: "user_not_found", message: "Account no longer exists." });
    }
    if (user.role === "owner") {
      throw new ForbiddenException({
        code: "owner_cannot_delete",
        message: "The owner account cannot be deleted. Transfer ownership to another account first.",
      });
    }

    if (user.passwordHash) {
      const ok = dto.password ? await verifyPassword(user.passwordHash, dto.password) : false;
      if (!ok) {
        throw new UnauthorizedException({ code: "invalid_password", message: "Password is incorrect." });
      }
    } else if (dto.confirmUsername !== user.username) {
      // A Discord/Google-only account has no password to type — retyping the
      // username is a deliberate-action check, not authentication (the
      // session itself already is).
      throw new BadRequestException({ code: "confirmation_mismatch", message: "Type your username exactly to confirm." });
    }

    await this.repo.deleteAccount(user.id, user.email);
  }

  /** Machine-readable copy of everything stored about the caller (data portability). Timestamps are ISO strings; secrets and hashes are never included — see UsersRepository.collectExport. */
  async exportData(userId: string) {
    const data = await this.repo.collectExport(userId);
    if (!data.user) {
      throw new NotFoundException({ code: "user_not_found", message: "Account no longer exists." });
    }
    const { avatarMimeType, profileVisibility, historyVisibility, favoritesVisibility, ...account } = data.user;
    return {
      exportedAt: new Date().toISOString(),
      account: { ...account, hasCustomAvatar: avatarMimeType !== null },
      privacy: { profileVisibility, historyVisibility, favoritesVisibility },
      linkedAccounts: data.oauthAccounts,
      devices: data.devices,
      sessions: data.sessions,
      loginHistory: data.loginEvents,
      unlockedChapters: data.chapterUnlocks,
      moderationHistory: data.sanctions,
      comments: data.comments,
      favorites: data.bookmarks,
      readingHistory: data.readingProgress,
      notifications: data.notifications,
      chapterAccessLog: data.imageAccess,
      accountActivity: data.activity,
    };
  }

  async getAvatarBytes(userId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const user = await this.repo.findAvatarById(userId);
    if (!user?.avatarImage || !user.avatarMimeType) return null;
    return { buffer: Buffer.from(user.avatarImage), mimeType: user.avatarMimeType };
  }

  /** Shared response shape for every self-service profile mutation (updateProfile, uploadAvatar). avatarVersion is only set when an avatar actually exists, so the frontend knows whether to fall back to the seeded placeholder. */
  private toPublic(user: {
    id: string;
    email: string;
    username: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
    displayName: string | null;
    bio: string | null;
    avatarImage: Buffer | Uint8Array | null;
    isBanned: boolean;
    bannedUntil: Date | null;
    mutedUntil: Date | null;
    passwordHash: string | null;
    profileVisibility: string;
    historyVisibility: string;
    favoritesVisibility: string;
  }) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
      displayName: user.displayName,
      bio: user.bio,
      avatarVersion: user.avatarImage ? user.updatedAt.toISOString() : null,
      isBanned: isEffectivelyBanned(user),
      mutedUntil: activeMutedUntil(user),
      hasPassword: user.passwordHash !== null,
      profileVisibility: user.profileVisibility,
      historyVisibility: user.historyVisibility,
      favoritesVisibility: user.favoritesVisibility,
    };
  }
}
