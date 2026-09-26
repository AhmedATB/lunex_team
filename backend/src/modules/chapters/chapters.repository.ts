import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ChaptersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: { seriesId: string; teamId: string | null; number: number; title: string }) {
    return this.prisma.chapter.create({ data });
  }

  findById(id: string) {
    return this.prisma.chapter.findUnique({
      where: { id },
      include: { pages: { orderBy: { pageNumber: "asc" } } },
    });
  }

  /** Regardless of isPublished — lets a resumed/retried machine push find a chapter it already created instead of hitting the seriesId+number unique constraint blind. */
  findBySeriesAndNumber(seriesId: string, number: number) {
    return this.prisma.chapter.findUnique({
      where: { seriesId_number: { seriesId, number } },
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

  update(id: string, data: { isPublished?: boolean; manualLock?: boolean | null; publishedAt?: Date | null }) {
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
}
