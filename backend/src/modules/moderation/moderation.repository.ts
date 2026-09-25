import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/** A sanction that is still doing something: not lifted, and either open-ended or not yet expired. */
const activeOfType = (userId: string, type: string, now: Date) => ({
  userId,
  type,
  revokedAt: null,
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
});

@Injectable()
export class ModerationRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUser(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, role: true, isBanned: true, bannedUntil: true, mutedUntil: true },
    });
  }

  /** A warning changes nothing about the account; it is only a recorded, delivered notice. */
  createWarning(params: { userId: string; reason: string; createdById: string }) {
    return this.prisma.sanction.create({ data: { ...params, type: "warning" } });
  }

  /** The record and its effect in one transaction, so a timeout can never exist without being enforced (or the reverse). */
  async createTimeout(params: { userId: string; reason: string; createdById: string; expiresAt: Date }) {
    const [sanction] = await this.prisma.$transaction([
      this.prisma.sanction.create({ data: { ...params, type: "timeout" } }),
      this.prisma.user.update({ where: { id: params.userId }, data: { mutedUntil: params.expiresAt } }),
    ]);
    return sanction;
  }

  /** Also kills every session — a ban has to take effect on the next request rather than whenever a refresh token happens to expire. */
  async createBan(params: { userId: string; reason: string; createdById: string; expiresAt: Date | null }) {
    const now = new Date();
    const [sanction] = await this.prisma.$transaction([
      this.prisma.sanction.create({ data: { ...params, type: "ban" } }),
      this.prisma.user.update({
        where: { id: params.userId },
        data: { isBanned: true, bannedAt: now, bannedUntil: params.expiresAt },
      }),
      this.prisma.session.updateMany({
        where: { userId: params.userId, revoked: false },
        data: { revoked: true, revokedAt: now },
      }),
    ]);
    return sanction;
  }

  async liftTimeout(userId: string, revokedById: string) {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.sanction.updateMany({
        where: activeOfType(userId, "timeout", now),
        data: { revokedAt: now, revokedById },
      }),
      this.prisma.user.update({ where: { id: userId }, data: { mutedUntil: null } }),
    ]);
  }

  /** Clears the ban columns even when no active sanction row exists — bans made before sanctions were recorded have none. */
  async liftBan(userId: string, revokedById: string) {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.sanction.updateMany({
        where: activeOfType(userId, "ban", now),
        data: { revokedAt: now, revokedById },
      }),
      this.prisma.user.update({ where: { id: userId }, data: { isBanned: false, bannedAt: null, bannedUntil: null } }),
    ]);
  }

  /** Clears the chosen parts of a profile: an offensive picture, bio or display name. */
  clearProfileParts(userId: string, parts: { avatar: boolean; bio: boolean; displayName: boolean }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(parts.avatar ? { avatarImage: null, avatarMimeType: null } : {}),
        ...(parts.bio ? { bio: null } : {}),
        ...(parts.displayName ? { displayName: null } : {}),
      },
    });
  }

  /** A one-off action with no lasting effect, kept in the history so the account record is complete. */
  recordAction(params: { userId: string; type: string; reason: string; details: string; createdById: string }) {
    return this.prisma.sanction.create({ data: params });
  }

  /** Every refresh token dies; the access token in hand runs out within its ten minutes. */
  revokeAllSessions(userId: string) {
    return this.prisma.session.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });
  }

  /** Hides all of an account's comments at once (soft, purged with the rest after the retention window). Returns how many. */
  async removeAllComments(userId: string, deletedById: string): Promise<number> {
    const { count } = await this.prisma.comment.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: new Date(), deletedById },
    });
    return count;
  }

  /** What an administrator needs to judge an account. Deliberately no IP addresses and no hashes. */
  async accountInfo(userId: string) {
    const now = new Date();
    const [user, lastLogin, activeSessions, comments] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, createdAt: true, passwordHash: true, oauthAccounts: { select: { provider: true } } },
      }),
      this.prisma.loginEvent.findFirst({ where: { userId, outcome: "success" }, orderBy: { at: "desc" }, select: { at: true } }),
      this.prisma.session.count({ where: { userId, revoked: false, expiresAt: { gt: now } } }),
      this.prisma.comment.count({ where: { userId, deletedAt: null } }),
    ]);
    if (!user) return null;
    return {
      email: user.email,
      createdAt: user.createdAt,
      hasPassword: user.passwordHash !== null,
      providers: user.oauthAccounts.map((a) => a.provider),
      lastLoginAt: lastLogin?.at ?? null,
      activeSessions,
      comments,
    };
  }

  retractWarning(sanctionId: string, revokedById: string) {
    return this.prisma.sanction.update({ where: { id: sanctionId }, data: { revokedAt: new Date(), revokedById } });
  }

  findSanction(id: string) {
    return this.prisma.sanction.findUnique({ where: { id } });
  }

  listSanctions(userId: string, take: number) {
    return this.prisma.sanction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take });
  }

  async findUsernames(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, username: true } });
    return new Map(rows.map((r) => [r.id, r.username]));
  }

  writeAuditLog(params: { actorId?: string; action: string; target?: string; ip?: string }) {
    return this.prisma.auditLog.create({ data: params });
  }
}
