import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { CatalogService } from "../catalog/catalog.service";
import { StorageService } from "../images/storage/storage.interface";
import { ChaptersRepository } from "./chapters.repository";
import { ChaptersService } from "./chapters.service";
import { makeThumbnail, previewOf, scorePage, suggestionGroups, ThumbnailImageError, type Thumbnail } from "./chapter-thumbnail.util";

/** How many pictures one round of suggestions offers. */
const ROUND_SIZE = 4;
/** A chapter longer than this is looked through at evenly spaced pages, not every one. */
const MAX_LOOKED_AT = 30;
/** How long the ranking of a chapter's pages is kept, so "suggest others" does not look at them all again. */
const RANKING_TTL_MS = 10 * 60_000;
const LOOK_AT_ONCE = 4;

export interface ThumbnailSuggestion {
  pageNumber: number;
  /** A small copy of the picture as it would be stored (a data address). */
  preview: string;
}

/**
 * A chapter's featured picture: chosen from four suggestions taken from its own pages (the parts of them that look best), from any
 * page, or uploaded. Only the people who publish may set it; showing it is the catalogue's job.
 */
@Injectable()
export class ChapterThumbnailService {
  private readonly rankings = new Map<string, { at: number; pagesKey: string; groups: number[][] }>();

  constructor(
    private readonly repo: ChaptersRepository,
    private readonly storage: StorageService,
    private readonly chapters: ChaptersService,
    private readonly catalog: CatalogService
  ) {}

  /** Round `round` (0, 1, 2 … wrapping round) of suggestions for the chapter's pages. */
  async suggestions(role: string, chapterId: string, round: number): Promise<{ items: ThumbnailSuggestion[]; rounds: number; pages: number }> {
    this.chapters.requirePublisher(role);
    const chapter = await this.chapters.get(chapterId);
    if (chapter.pages.length === 0) return { items: [], rounds: 0, pages: 0 };

    const groups = await this.groupsFor(chapterId, chapter.pages);
    const group = groups[((round % groups.length) + groups.length) % groups.length];
    const items = await Promise.all(
      group.map(async (pageNumber) => ({ pageNumber, preview: await previewOf(await this.thumbnailOfPage(chapter.pages, pageNumber, "crop")) }))
    );
    return { items, rounds: groups.length, pages: chapter.pages.length };
  }

  /** The featured picture from one of the chapter's own pages. */
  async fromPage(role: string, chapterId: string, pageNumber: number): Promise<{ thumbnailAssetId: string }> {
    this.chapters.requirePublisher(role);
    const chapter = await this.chapters.get(chapterId);
    return this.set(chapter.id, await this.thumbnailOfPage(chapter.pages, pageNumber, "crop"));
  }

  /** The featured picture from a picture the person uploads. */
  async upload(role: string, chapterId: string, file: Express.Multer.File | undefined): Promise<{ thumbnailAssetId: string }> {
    this.chapters.requirePublisher(role);
    const chapter = await this.chapters.get(chapterId);
    if (!file) throw new BadRequestException({ code: "missing_file", message: "No image file was uploaded." });
    return this.set(chapter.id, await this.make(file.buffer, "keep"));
  }

  /** Takes the featured picture off (the stored picture stays in storage, as a replaced page does; nothing points to it). */
  async remove(role: string, chapterId: string): Promise<void> {
    this.chapters.requirePublisher(role);
    const chapter = await this.chapters.get(chapterId);
    if (!chapter.thumbnailAssetId) return;
    await this.repo.update(chapter.id, { thumbnailAssetId: null });
    this.catalog.invalidate();
  }

  private async set(chapterId: string, thumbnail: Thumbnail) {
    const storageKey = `chapters/${randomUUID()}.webp`;
    const { checksum } = await this.storage.put(storageKey, thumbnail.data);
    const asset = await this.repo.createAsset({ storageKey, checksum, mimeType: "image/webp", width: thumbnail.width, height: thumbnail.height });
    await this.repo.update(chapterId, { thumbnailAssetId: asset.id });
    this.catalog.invalidate(); // the chapter list shows it at once, not after the cache runs out
    return { thumbnailAssetId: asset.id };
  }

  private async make(bytes: Buffer, mode: "crop" | "keep"): Promise<Thumbnail> {
    try {
      return await makeThumbnail(bytes, mode);
    } catch (error) {
      if (error instanceof ThumbnailImageError) throw new BadRequestException({ code: "invalid_image", message: error.message });
      throw error;
    }
  }

  private async bytesOfPage(pages: { pageNumber: number; assetId: string }[], pageNumber: number): Promise<Buffer> {
    const page = pages.find((p) => p.pageNumber === pageNumber);
    const asset = page ? await this.repo.findAsset(page.assetId) : null;
    if (!asset) throw new NotFoundException({ code: "page_not_found", message: "Page not found in this chapter." });
    return this.storage.get(asset.storageKey);
  }

  private async thumbnailOfPage(pages: { pageNumber: number; assetId: string }[], pageNumber: number, mode: "crop" | "keep") {
    return this.make(await this.bytesOfPage(pages, pageNumber), mode);
  }

  /** The chapter's pages ranked and dealt into rounds; looked through once, then kept for a few minutes. */
  private async groupsFor(chapterId: string, pages: { pageNumber: number; assetId: string }[]): Promise<number[][]> {
    const pagesKey = pages.map((p) => `${p.pageNumber}:${p.assetId}`).join(",");
    const kept = this.rankings.get(chapterId);
    if (kept && kept.pagesKey === pagesKey && Date.now() - kept.at < RANKING_TTL_MS) return kept.groups;

    // Every page of a short chapter; evenly spaced ones of a long one.
    const looked = pages.length <= MAX_LOOKED_AT ? pages : Array.from({ length: MAX_LOOKED_AT }, (_, i) => pages[Math.floor((i * pages.length) / MAX_LOOKED_AT)]);
    const scored: { pageNumber: number; score: number }[] = [];
    for (let i = 0; i < looked.length; i += LOOK_AT_ONCE) {
      const batch = looked.slice(i, i + LOOK_AT_ONCE);
      const results = await Promise.all(
        batch.map(async (page) => {
          try {
            const { score } = await scorePage(await this.bytesOfPage(pages, page.pageNumber));
            // The first page is often the title and the last ones the credits: fair game, but not the favourites.
            const edge = pages.length >= 6 && (page.pageNumber === pages[0].pageNumber || page.pageNumber >= pages[pages.length - 2].pageNumber);
            return { pageNumber: page.pageNumber, score: edge ? score * 0.85 : score };
          } catch {
            return { pageNumber: page.pageNumber, score: 0 };
          }
        })
      );
      scored.push(...results);
    }
    const groups = suggestionGroups(scored, ROUND_SIZE);
    this.rankings.set(chapterId, { at: Date.now(), pagesKey, groups });
    if (this.rankings.size > 200) this.rankings.delete(this.rankings.keys().next().value as string);
    return groups;
  }
}
