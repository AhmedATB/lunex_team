import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  updateRole(id: string, role: string) {
    return this.prisma.user.update({ where: { id }, data: { role } });
  }

  updateBanned(id: string, isBanned: boolean) {
    return this.prisma.user.update({ where: { id }, data: { isBanned, bannedAt: isBanned ? new Date() : null } });
  }

  /** Real accounts only — this is the one place an admin can reliably find every banned user, since the admin UI otherwise only knows about real accounts it has locally cached. */
  listBanned() {
    return this.prisma.user.findMany({ where: { isBanned: true }, orderBy: { bannedAt: "desc" } });
  }

  updateProfile(id: string, patch: { username?: string; displayName?: string; bio?: string }) {
    return this.prisma.user.update({ where: { id }, data: patch });
  }

  updateAvatar(id: string, avatarImage: Buffer, avatarMimeType: string) {
    return this.prisma.user.update({ where: { id }, data: { avatarImage, avatarMimeType } });
  }

  findAvatarById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: { avatarImage: true, avatarMimeType: true } });
  }

  writeAuditLog(params: { actorId?: string; action: string; target?: string; ip?: string }) {
    return this.prisma.auditLog.create({ data: params });
  }
}
