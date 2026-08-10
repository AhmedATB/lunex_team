import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class OAuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAccount(provider: string, providerAccountId: string) {
    return this.prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      include: { user: true },
    });
  }

  linkAccount(userId: string, provider: string, providerAccountId: string) {
    return this.prisma.oAuthAccount.create({ data: { userId, provider, providerAccountId } });
  }

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findUserByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  createUserFromOAuth(email: string, username: string) {
    // passwordHash intentionally omitted — Prisma leaves it null. login()'s
    // existing dummy-hash comparison already makes a null hash fail closed
    // for password-based login attempts, so no extra guard is needed there.
    return this.prisma.user.create({ data: { email, username } });
  }

  writeAuditLog(params: { actorId?: string; action: string; target?: string; ip?: string }) {
    return this.prisma.auditLog.create({ data: params });
  }
}
