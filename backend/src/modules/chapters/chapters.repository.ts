import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ChaptersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: { seriesId: string; teamId: string; number: number; title: string }) {
    return this.prisma.chapter.create({ data });
  }

  findById(id: string) {
    return this.prisma.chapter.findUnique({
      where: { id },
      include: { pages: { orderBy: { pageNumber: "asc" } } },
    });
  }

  /** Published-only — this is the shape the public reader sees. */
  listPublishedBySeries(seriesId: string) {
    return this.prisma.chapter.findMany({
      where: { seriesId, isPublished: true },
      orderBy: { number: "asc" },
    });
  }

  /** Everything, newest first — the admin table's view, including drafts. */
  listRecent(limit: number) {
    return this.prisma.chapter.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { pages: true },
    });
  }

  update(id: string, data: { isPublished?: boolean }) {
    return this.prisma.chapter.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.chapter.delete({ where: { id } });
  }

  findPage(chapterId: string, pageNumber: number) {
    return this.prisma.chapterPage.findUnique({
      where: { chapterId_pageNumber: { chapterId, pageNumber } },
    });
  }

  createPage(data: { chapterId: string; pageNumber: number; assetId: string }) {
    return this.prisma.chapterPage.create({ data });
  }

  createAsset(data: { storageKey: string; checksum: string; mimeType: string; width: number; height: number }) {
    return this.prisma.imageAsset.create({ data });
  }

  countPages(chapterId: string) {
    return this.prisma.chapterPage.count({ where: { chapterId } });
  }

  findUnlock(userId: string, chapterId: string) {
    return this.prisma.chapterUnlock.findUnique({ where: { userId_chapterId: { userId, chapterId } } });
  }

  createUnlock(userId: string, chapterId: string) {
    return this.prisma.chapterUnlock.create({ data: { userId, chapterId } });
  }

  /** The series' current highest published chapter number — the free-window check needs this to know how far back "free" reaches. */
  async findLatestPublishedNumber(seriesId: string): Promise<number> {
    const latest = await this.prisma.chapter.findFirst({
      where: { seriesId, isPublished: true },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    return latest?.number ?? 0;
  }
}
