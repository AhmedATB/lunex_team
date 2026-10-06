import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AnnouncementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSeries(id: string) {
    return this.prisma.series.findUnique({
      where: { id },
      select: { id: true, slug: true, state: true, titleAr: true, titleEn: true, synopsis: true, updatedAt: true, coverAssetId: true, teamId: true },
    });
  }

  /**
   * An announcement that is waiting out its gathering time, kept so a restart does not lose it. Saving again (another chapter of the
   * same work joined the batch) updates the numbers and keeps the original due time.
   */
  savePending(kind: "chapter" | "series", seriesId: string, numbers: number[], dueAt: Date) {
    return this.prisma.pendingAnnouncement.upsert({
      where: { kind_seriesId: { kind, seriesId } },
      update: { numbers },
      create: { kind, seriesId, numbers, dueAt },
    });
  }

  async clearPending(kind: "chapter" | "series", seriesId: string): Promise<void> {
    await this.prisma.pendingAnnouncement.deleteMany({ where: { kind, seriesId } });
  }

  /** Everything still waiting, soonest first — what the backend picks up again when it starts. */
  pendingAnnouncements() {
    return this.prisma.pendingAnnouncement.findMany({ orderBy: { dueAt: "asc" } });
  }

  /** The genres and themes of a work, in Arabic, as the team listed them. */
  async genres(seriesId: string): Promise<string[]> {
    const rows = await this.prisma.seriesTag.findMany({ where: { seriesId }, select: { tag: { select: { nameAr: true, group: true } } } });
    return rows.map((r) => r.tag).filter((t) => t.group === "genre" && t.nameAr).map((t) => t.nameAr);
  }

  async teamName(teamId: string | null): Promise<string | null> {
    if (!teamId) return null;
    return (await this.prisma.team.findUnique({ where: { id: teamId }, select: { name: true } }))?.name ?? null;
  }

  /**
   * The team's own Discord server, if it set a webhook there for this `kind` of post: the address, and the role to ping (that
   * server's roles are the team's own, never the site's). The two webhooks are independent — a team may set either, both, or
   * neither.
   */
  async teamDiscord(teamId: string | null, kind: "chapter" | "series"): Promise<{ webhookUrl: string; roleId: string | null } | null> {
    if (!teamId) return null;
    const team = await this.prisma.team.findUnique({ where: { id: teamId }, select: { discordChapterWebhookUrl: true, discordSeriesWebhookUrl: true, discordRoleId: true } });
    const webhookUrl = kind === "chapter" ? team?.discordChapterWebhookUrl : team?.discordSeriesWebhookUrl;
    return webhookUrl ? { webhookUrl, roleId: team?.discordRoleId ?? null } : null;
  }

  /** The featured picture of the newest of these chapters that has one (the batch's face), if any. */
  async latestThumbnail(seriesId: string, numbers: number[]): Promise<{ id: string; thumbnailAssetId: string } | null> {
    const row = await this.prisma.chapter.findFirst({
      where: { seriesId, number: { in: numbers }, thumbnailAssetId: { not: null } },
      orderBy: { number: "desc" },
      select: { id: true, thumbnailAssetId: true },
    });
    return row && row.thumbnailAssetId ? { id: row.id, thumbnailAssetId: row.thumbnailAssetId } : null;
  }

  /** Which of these chapters are still live (one taken down within the minute the announcement waits is not announced). */
  async stillPublished(seriesId: string, numbers: number[]): Promise<number[]> {
    const rows = await this.prisma.chapter.findMany({ where: { seriesId, number: { in: numbers }, isPublished: true }, select: { number: true } });
    return rows.map((r) => r.number).sort((a, b) => a - b);
  }
}
