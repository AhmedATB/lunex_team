import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

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

  findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  createUser(email: string, username: string, passwordHash: string) {
    return this.prisma.user.create({ data: { email, username, passwordHash } });
  }

  async upsertDevice(userId: string, fingerprintHash: string) {
    return this.prisma.device.upsert({
      where: { userId_fingerprintHash: { userId, fingerprintHash } },
      update: {},
      create: { userId, fingerprintHash },
    });
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

  revokeSession(id: string) {
    return this.prisma.session.update({
      where: { id },
      data: { revoked: true, revokedAt: new Date() },
    });
  }

  revokeSessionFamily(familyId: string) {
    return this.prisma.session.updateMany({
      where: { familyId, revoked: false },
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
