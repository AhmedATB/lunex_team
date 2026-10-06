import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ChaptersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: { seriesId: string; teamId: string | null; number: number; title: string }) {
    return this.prisma.chapter.create({ data });
  }

  /** The Arabic title of a series, for the words of a team's activity log. */
  seriesTitle(id: string) {
    return this.prisma.series.findUnique({ where: { id }, select: { titleAr: true } }).then((row) => row?.titleAr ?? null);
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

  /** Who owns a series and whether it has been approved — what decides who may work on its chapters and whether they may go live. */
  seriesAccess(id: string) {
    return this.prisma.series.findUnique({ where: { id }, select: { teamId: true, state: true } });
  }

  /** Everything, newest first — the admin table's view, including drafts. `teamIds` narrows it to the series those teams own. */
  async listRecent(limit: number, teamIds?: string[]) {
    const seriesIds = teamIds ? (await this.prisma.series.findMany({ where: { teamId: { in: teamIds } }, select: { id: true } })).map((row) => row.id) : null;
    return this.prisma.chapter.findMany({
      where: seriesIds ? { seriesId: { in: seriesIds } } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { pages: true },
    });
  }

  update(id: string, data: { isPublished?: boolean; manualLock?: boolean | null; publishedAt?: Date | null; thumbnailAssetId?: string | null; title?: string; number?: number }) {
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

  /** Points page `pageNumber` at another picture (the old one is left where it is; no reader is sent to it any more). */
  updatePageAsset(chapterId: string, pageNumber: number, assetId: string) {
    return this.prisma.chapterPage.update({ where: { chapterId_pageNumber: { chapterId, pageNumber } }, data: { assetId } });
  }

  /** Deletes page `pageNumber` and moves every later page up by one, in one transaction (ascending, so no two pages ever share a number). */
  deletePageAndClose(chapterId: string, pageNumber: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.chapterPage.delete({ where: { chapterId_pageNumber: { chapterId, pageNumber } } });
      const later = await tx.chapterPage.findMany({ where: { chapterId, pageNumber: { gt: pageNumber } }, orderBy: { pageNumber: "asc" }, select: { pageNumber: true } });
      for (const page of later) {
        await tx.chapterPage.update({ where: { chapterId_pageNumber: { chapterId, pageNumber: page.pageNumber } }, data: { pageNumber: page.pageNumber - 1 } });
      }
    });
  }

  /**
   * The two pages change places. A picture belongs to one page only (assetId is unique), so the pages trade their numbers instead,
   * through a number no page uses (0) so the chapter never has two pages with the same number.
   */
  swapPageNumbers(chapterId: string, a: number, b: number) {
    const at = (pageNumber: number) => ({ chapterId_pageNumber: { chapterId, pageNumber } });
    return this.prisma.$transaction([
      this.prisma.chapterPage.update({ where: at(a), data: { pageNumber: 0 } }),
      this.prisma.chapterPage.update({ where: at(b), data: { pageNumber: a } }),
      this.prisma.chapterPage.update({ where: at(0), data: { pageNumber: b } }),
    ]);
  }

  findAsset(id: string) {
    return this.prisma.imageAsset.findUnique({ where: { id } });
  }

  createAsset(data: { storageKey: string; checksum: string; mimeType: string; width: number; height: number }) {
    return this.prisma.imageAsset.create({ data });
  }

  countPages(chapterId: string) {
    return this.prisma.chapterPage.count({ where: { chapterId } });
  }
}
