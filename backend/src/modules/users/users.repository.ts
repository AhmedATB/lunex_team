import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/** Upper bound per log table in a data export. */
const EXPORT_LOG_LIMIT = 1000;

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

  /** Real accounts only — this is the one place an admin can reliably find every banned user, since the admin UI otherwise only knows about real accounts it has locally cached. */
  listBanned() {
    return this.prisma.user.findMany({
      where: { isBanned: true, OR: [{ bannedUntil: null }, { bannedUntil: { gt: new Date() } }] },
      orderBy: { bannedAt: "desc" },
    });
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

  /**
   * Everything the platform stores about one account, for the self-service
   * data export. Deliberately an allow-list of columns (never `include: true`)
   * so passwordHash, refresh-token hashes and device fingerprint hashes can't
   * leak into the file by a future schema addition. The log tables are capped
   * — an export is a copy for the person, not a dump of the whole table.
   */
  async collectExport(userId: string) {
    const [
      user,
      oauthAccounts,
      devices,
      sessions,
      loginEvents,
      chapterUnlocks,
      notifications,
      imageAccess,
      activity,
      bookmarks,
      readingProgress,
      sanctions,
      comments,
    ] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            username: true,
            displayName: true,
            bio: true,
            role: true,
            isBanned: true,
            createdAt: true,
            updatedAt: true,
            avatarMimeType: true,
            profileVisibility: true,
            historyVisibility: true,
            favoritesVisibility: true,
          },
        }),
        this.prisma.oAuthAccount.findMany({
          where: { userId },
          select: { provider: true, providerAccountId: true, createdAt: true },
        }),
        this.prisma.device.findMany({
          where: { userId },
          select: { firstSeenAt: true, lastSeenAt: true, trustScore: true },
        }),
        this.prisma.session.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: EXPORT_LOG_LIMIT,
          select: { createdAt: true, expiresAt: true, revoked: true, revokedAt: true },
        }),
        this.prisma.loginEvent.findMany({
          where: { userId },
          orderBy: { at: "desc" },
          take: EXPORT_LOG_LIMIT,
          select: { at: true, ip: true, outcome: true },
        }),
        this.prisma.chapterUnlock.findMany({
          where: { userId },
          select: { chapterId: true, unlockedAt: true },
        }),
        this.prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: EXPORT_LOG_LIMIT,
          select: { type: true, title: true, body: true, link: true, read: true, createdAt: true },
        }),
        this.prisma.imageAccessLog.findMany({
          where: { userId },
          orderBy: { at: "desc" },
          take: EXPORT_LOG_LIMIT,
          select: { at: true, event: true, assetId: true, ip: true, reason: true },
        }),
        this.prisma.auditLog.findMany({
          where: { actorId: userId },
          orderBy: { at: "desc" },
          take: EXPORT_LOG_LIMIT,
          select: { at: true, action: true, target: true, ip: true },
        }),
        this.prisma.bookmark.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          select: { seriesId: true, createdAt: true },
        }),
        this.prisma.readingProgress.findMany({
          where: { userId },
          orderBy: { lastReadAt: "desc" },
          select: { seriesId: true, chapterNumber: true, lastReadAt: true },
        }),
        this.prisma.sanction.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          select: { type: true, reason: true, createdAt: true, expiresAt: true, revokedAt: true },
        }),
        this.prisma.comment.findMany({
          where: { userId, deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: EXPORT_LOG_LIMIT,
          select: { seriesId: true, content: true, isSpoiler: true, createdAt: true, editedAt: true },
        }),
      ]);

    return {
      user,
      oauthAccounts,
      devices,
      sessions,
      loginEvents,
      chapterUnlocks,
      notifications,
      imageAccess,
      activity,
      bookmarks,
      readingProgress,
      sanctions,
      comments,
    };
  }

  /**
   * One transaction so a half-deleted account can never exist. The user row's
   * relations (sessions, devices, OAuth links, notifications, unlocks) cascade
   * from the schema; login events only SetNull their userId, and they also
   * carry the email + IP, so they're removed here explicitly — by userId AND
   * by email, since failed attempts before the account was linked only have
   * the email.
   *
   * ImageAccessLog / AuditLog rows are intentionally NOT deleted: they're the
   * security and anti-piracy ledgers, and RetentionService expires them on
   * schedule (documented in the privacy policy). The audit entry written here
   * carries no IP for the same reason the account is going away.
   */
  deleteAccount(userId: string, email: string) {
    return this.prisma.$transaction([
      this.prisma.loginEvent.deleteMany({ where: { OR: [{ userId }, { email }] } }),
      this.prisma.user.delete({ where: { id: userId } }),
      this.prisma.auditLog.create({ data: { actorId: userId, action: "user.account_deleted", target: userId } }),
    ]);
  }
}
