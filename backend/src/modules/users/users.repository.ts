import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { usernameKey } from "./username.util";

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

  /** The account holding this name or any look-alike of it (see username.util.ts). */
  findByUsernameKey(username: string) {
    return this.prisma.user.findUnique({ where: { usernameKey: usernameKey(username) } });
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

  /**
   * One page of every account, newest first, for the owner's user list. Avatar bytes are not loaded: the list only needs
   * to know whether a picture exists.
   */
  async listAll(params: { query?: string; role?: string; bannedOnly?: boolean; skip: number; take: number }) {
    const q = params.query?.trim();
    const where = {
      ...(params.role ? { role: params.role } : {}),
      ...(params.bannedOnly ? { isBanned: true, OR: [{ bannedUntil: null }, { bannedUntil: { gt: new Date() } }] } : {}),
      ...(q
        ? {
            AND: [
              {
                OR: [
                  { username: { contains: q, mode: "insensitive" as const } },
                  { displayName: { contains: q, mode: "insensitive" as const } },
                  { email: { contains: q, mode: "insensitive" as const } },
                ],
              },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: params.skip,
        take: params.take,
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          displayName: true,
          bio: true,
          avatarMimeType: true,
          isBanned: true,
          bannedUntil: true,
          mutedUntil: true,
          xp: true,
          chaptersRead: true,
        },
      }),
    ]);
    return { total, rows };
  }

  /** Accounts whose username or display name contains the text (banned ones never appear), identity fields only. */
  searchPeople(term: string, take: number) {
    return this.prisma.user.findMany({
      where: {
        isBanned: false,
        OR: [{ username: { contains: term, mode: "insensitive" } }, { displayName: { contains: term, mode: "insensitive" } }],
      },
      select: { id: true, username: true, displayName: true, avatarMimeType: true, updatedAt: true },
      take,
    });
  }

  updateProfile(id: string, patch: { username?: string; displayName?: string; bio?: string }) {
    // A new username brings its key along, so the unique index keeps refusing look-alikes.
    const data = patch.username ? { ...patch, usernameKey: usernameKey(patch.username) } : patch;
    return this.prisma.user.update({ where: { id }, data });
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
      ratings,
      chapterViews,
      coinTransactions,
      messages,
      conversations,
      recruitmentApplications,
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
            xp: true,
            chaptersRead: true,
            streakDays: true,
            bestStreak: true,
            achievements: true,
            coins: true,
            unlockCredits: true,
            creditProgress: true,
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
          select: { seriesId: true, chapterNumber: true, completedThrough: true, lastReadAt: true },
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
        this.prisma.seriesRating.findMany({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          select: { seriesId: true, value: true, createdAt: true, updatedAt: true },
        }),
        this.prisma.chapterView.findMany({
          where: { userId },
          orderBy: { day: "desc" },
          take: EXPORT_LOG_LIMIT,
          select: { seriesId: true, chapterId: true, day: true },
        }),
        // The staff account that granted coins is left out: it is someone else's identifier.
        this.prisma.coinTransaction.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: EXPORT_LOG_LIMIT,
          select: { amount: true, reason: true, chapterId: true, note: true, createdAt: true },
        }),
        // Only what the person wrote: messages other people sent them are those people's data, not theirs to export.
        this.prisma.message.findMany({
          where: { senderId: userId },
          orderBy: { createdAt: "desc" },
          take: EXPORT_LOG_LIMIT,
          select: { conversationId: true, text: true, createdAt: true },
        }),
        this.prisma.conversationMember.findMany({
          where: { userId },
          orderBy: { joinedAt: "desc" },
          select: { joinedAt: true, conversation: { select: { id: true, title: true, isGroup: true } } },
        }),
        this.prisma.recruitmentApplication.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          select: {
            teamId: true,
            preferredRole: true,
            experience: true,
            portfolioUrl: true,
            languages: true,
            availability: true,
            status: true,
            note: true,
            createdAt: true,
            reviewedAt: true,
          },
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
      ratings,
      chapterViews,
      coinTransactions,
      messages,
      conversations,
      recruitmentApplications,
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
