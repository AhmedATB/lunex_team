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

  async teamName(teamId: string | null): Promise<string | null> {
    if (!teamId) return null;
    return (await this.prisma.team.findUnique({ where: { id: teamId }, select: { name: true } }))?.name ?? null;
  }

  /** Which of these chapters are still live (one taken down within the minute the announcement waits is not announced). */
  async stillPublished(seriesId: string, numbers: number[]): Promise<number[]> {
    const rows = await this.prisma.chapter.findMany({ where: { seriesId, number: { in: numbers }, isPublished: true }, select: { number: true } });
    return rows.map((r) => r.number).sort((a, b) => a - b);
  }
}
