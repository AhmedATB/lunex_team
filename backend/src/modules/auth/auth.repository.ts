import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { usernameKey } from "../users/username.util";

/**
 * The only file in this module allowed to touch Prisma directly (architecture
 * doc §2/§3) — AuthService orchestrates, this executes queries. Keeping that
 * boundary means swapping ORMs or adding query-level caching later never
 * touches business logic.
 */
@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findUserByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  /** The account holding this name or any look-alike of it (see username.util.ts). */
  findUserByUsernameKey(username: string) {
    return this.prisma.user.findUnique({ where: { usernameKey: usernameKey(username) } });
  }

  findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  createUser(email: string, username: string, passwordHash: string, displayName?: string) {
    return this.prisma.user.create({ data: { email, username, usernameKey: usernameKey(username), passwordHash, displayName: displayName ?? null } });
  }

  updatePassword(id: string, passwordHash: string) {
    return this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  /** The newest reset link asked for by this account (used or not) — the mail cooldown reads it. */
  latestPasswordReset(userId: string) {
    return this.prisma.passwordReset.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  }

  /** One live link per account: a new request replaces the older ones. Expired rows from anybody are swept along the way. */
  async replacePasswordReset(userId: string, tokenHash: string, expiresAt: Date) {
    const longGone = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.prisma.$transaction([
      this.prisma.passwordReset.deleteMany({ where: { OR: [{ userId }, { expiresAt: { lt: longGone } }] } }),
      this.prisma.passwordReset.create({ data: { userId, tokenHash, expiresAt } }),
    ]);
  }

  findPasswordReset(tokenHash: string) {
    return this.prisma.passwordReset.findUnique({ where: { tokenHash } });
  }

  /** Marks the link used, once: false if somebody else got there first (two tabs, a replayed request). */
  async claimPasswordReset(id: string): Promise<boolean> {
    const { count } = await this.prisma.passwordReset.updateMany({ where: { id, usedAt: null }, data: { usedAt: new Date() } });
    return count === 1;
  }

  deletePasswordResetByHash(tokenHash: string) {
    return this.prisma.passwordReset.deleteMany({ where: { tokenHash } });
  }

  deletePasswordResetsForUser(userId: string) {
    return this.prisma.passwordReset.deleteMany({ where: { userId } });
  }

  /** `isNew` lets the caller notify the user on a genuinely new device, without a second query — `upsert` alone doesn't say which branch it took. */
  async upsertDevice(userId: string, fingerprintHash: string) {
    const where = { userId_fingerprintHash: { userId, fingerprintHash } };
    const existing = await this.prisma.device.findUnique({ where });
    try {
      const device = await this.prisma.device.upsert({ where, update: {}, create: { userId, fingerprintHash } });
      return { device, isNew: !existing };
    } catch (err) {
      // Two requests from a device seen for the first time (a browser coming back fires several at once) both tried to create it:
      // the loser finds the winner's row instead of failing.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const device = await this.prisma.device.findUnique({ where });
        if (device) return { device, isNew: false };
      }
      throw err;
    }
  }

  createSession(params: {
    userId: string;
    deviceId: string;
    familyId: string;
    refreshTokenHash: string;
    expiresAt: Date;
  }) {
    return this.prisma.session.create({ data: params });
  }

  findSessionByRefreshHash(refreshTokenHash: string) {
    return this.prisma.session.findUnique({ where: { refreshTokenHash } });
  }

  /** `rotated` marks a session consumed by a refresh (see `Session.rotatedAt`); a logout leaves it unset. */
  revokeSession(id: string, rotated = false) {
    const now = new Date();
    return this.prisma.session.update({
      where: { id },
      data: { revoked: true, revokedAt: now, ...(rotated ? { rotatedAt: now } : {}) },
    });
  }

  /** Whether some session of this family can still be used — the family has not been logged out, banned or revoked as a whole. */
  async hasLiveSessionInFamily(familyId: string): Promise<boolean> {
    return (await this.prisma.session.count({ where: { familyId, revoked: false, expiresAt: { gt: new Date() } } })) > 0;
  }

  revokeSessionFamily(familyId: string) {
    return this.prisma.session.updateMany({
      where: { familyId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });
  }

  /** Used when banning a user — kills every device/session at once, not just one family. */
  revokeAllSessionsForUser(userId: string) {
    return this.prisma.session.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });
  }

  recordLoginEvent(params: {
    userId?: string;
    email: string;
    ip: string;
    outcome: string;
    riskScore?: number;
  }) {
    return this.prisma.loginEvent.create({ data: params });
  }

  writeAuditLog(params: { actorId?: string; action: string; target?: string; ip?: string }) {
    return this.prisma.auditLog.create({ data: params });
  }
}
