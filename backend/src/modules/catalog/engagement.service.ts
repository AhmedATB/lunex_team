import { Injectable, NotFoundException } from "@nestjs/common";
import { CatalogService } from "./catalog.service";
import { EngagementRepository } from "./engagement.repository";
import { roundRating, utcDay } from "./catalog.util";
import { ProgressService } from "../progress/progress.service";

/**
 * What readers do to the numbers on the site: opening a chapter counts a view, and a rating replaces the
 * reader's previous one. The catalogue shows the results (views, this week's views, average and count), so a
 * rating drops the memoised catalogue at once; views only move the numbers by one, and the short cache is enough.
 */
@Injectable()
export class EngagementService {
  constructor(
    private readonly repo: EngagementRepository,
    private readonly catalog: CatalogService,
    private readonly progress: ProgressService
  ) {}

  async recordView(userId: string, chapterId: string, now: Date = new Date()): Promise<{ counted: boolean }> {
    const chapter = await this.repo.findPublishedChapter(chapterId);
    if (!chapter) throw new NotFoundException({ code: "chapter_not_found", message: "Chapter not found." });
    const counted = await this.repo.recordView({ chapterId: chapter.id, seriesId: chapter.seriesId, userId, day: utcDay(now) });
    return { counted };
  }

  async setRating(userId: string, seriesId: string, value: number) {
    await this.assertSeries(seriesId);
    const first = (await this.repo.findRating(userId, seriesId)) === null;
    await this.repo.upsertRating(userId, seriesId, value);
    if (first) await this.progress.awardRating(userId); // experience for a first rating of a series; changing it earns nothing
    this.catalog.invalidate();
    return this.rating(userId, seriesId);
  }

  async clearRating(userId: string, seriesId: string) {
    await this.assertSeries(seriesId);
    await this.repo.deleteRating(userId, seriesId);
    this.catalog.invalidate();
  }

  /** The live average and count, and this reader's own rating (null if they have not rated). */
  async rating(userId: string, seriesId: string) {
    await this.assertSeries(seriesId);
    const [summary, mine] = await Promise.all([this.repo.ratingSummary(seriesId), this.repo.findRating(userId, seriesId)]);
    return { average: roundRating(summary.average), count: summary.count, mine: mine?.value ?? null };
  }

  private async assertSeries(seriesId: string) {
    if (!(await this.repo.seriesExists(seriesId))) throw new NotFoundException({ code: "series_not_found", message: "Series not found." });
  }
}
