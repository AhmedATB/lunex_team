import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class EngagementRepository {
  constructor(private readonly prisma: PrismaService) {}

  findPublishedChapter(id: string) {
    return this.prisma.chapter.findFirst({ where: { id, isPublished: true }, select: { id: true, seriesId: true } });
  }

  seriesExists(id: string) {
    return this.prisma.series.count({ where: { id, state: "approved" } }).then((n) => n > 0);
  }

  /**
   * Records that a reader opened a chapter today. The unique (chapter, reader, day) row makes a repeat the same
   * day a no-op; only a first open moves the running totals. Returns whether it was counted.
   */
  recordView(params: { chapterId: string; seriesId: string; userId: string; day: Date }): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.chapterView.createMany({ data: [params], skipDuplicates: true });
      if (created.count === 0) return false;
      await tx.chapter.update({ where: { id: params.chapterId }, data: { viewCount: { increment: 1 } } });
      await tx.series.update({ where: { id: params.seriesId }, data: { viewCount: { increment: 1 } } });
      return true;
    });
  }

  upsertRating(userId: string, seriesId: string, value: number) {
    return this.prisma.seriesRating.upsert({
      where: { userId_seriesId: { userId, seriesId } },
      create: { userId, seriesId, value },
      update: { value },
      select: { value: true },
    });
  }

  deleteRating(userId: string, seriesId: string) {
    return this.prisma.seriesRating.deleteMany({ where: { userId, seriesId } });
  }

  findRating(userId: string, seriesId: string) {
    return this.prisma.seriesRating.findUnique({ where: { userId_seriesId: { userId, seriesId } }, select: { value: true } });
  }

  async ratingSummary(seriesId: string): Promise<{ average: number; count: number }> {
    const { _avg, _count } = await this.prisma.seriesRating.aggregate({ where: { seriesId }, _avg: { value: true }, _count: { _all: true } });
    return { average: _avg.value ?? 0, count: _count._all };
  }
}
