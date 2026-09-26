import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { CatalogService } from "../catalog/catalog.service";
import { ImagesService, type IssuedImageToken } from "../images/images.service";
import { StorageService } from "../images/storage/storage.interface";
import type { RequestContext } from "../../common/middleware/request-context.middleware";
import { WalletService } from "../wallet/wallet.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { UnlockMethod } from "../wallet/wallet.repository";
import { ChaptersRepository } from "./chapters.repository";
import { PageImageError, preparePage, type PageSlice } from "./page-image.util";

/**
 * Mirrors the frontend's rbac.ts GLOBAL_ROLE_PERMISSIONS (publish_chapters/
 * upload_images granted to uploader/editor/super_administrator/owner) —
 * duplicated deliberately, not imported, same reasoning UsersService gives
 * for ROLE_MANAGER_ROLES: the two apps don't share a types package yet.
 *
 * Deliberately does NOT check team membership — Team/TeamRole are still
 * frontend-mock-only (architecture doc §4/§19), so a real, server-enforced
 * per-team check isn't possible yet without migrating teams too. This is a
 * documented, bounded gap for this phase, not an oversight: any account
 * holding one of these global roles can publish to any series/team through
 * this API, even though the admin UI would only ever show the button for
 * teams the mock permission system says they belong to.
 */
const CAN_PUBLISH_GLOBAL_ROLES = new Set(["uploader", "editor", "super_administrator", "owner"]);

/** What the image log and the token record for a reader without an account (the device and address are logged beside it). */
const GUEST_READER = "guest";

@Injectable()
export class ChaptersService {
  constructor(
    private readonly repo: ChaptersRepository,
    private readonly storage: StorageService,
    private readonly images: ImagesService,
    private readonly wallet: WalletService,
    private readonly notifications: NotificationsService,
    private readonly catalog: CatalogService
  ) {}

  private assertCanPublish(role: string) {
    if (!CAN_PUBLISH_GLOBAL_ROLES.has(role)) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot publish chapters." });
    }
  }

  /** `teamId` may be left out: a work that belongs to no team is published by the site's staff on its own. */
  async create(role: string, dto: { seriesId: string; teamId?: string; number: number; title: string }) {
    this.assertCanPublish(role);
    return this.repo.create({ seriesId: dto.seriesId, teamId: dto.teamId?.trim() || null, number: dto.number, title: dto.title });
  }

  async get(id: string) {
    const chapter = await this.repo.findById(id);
    if (!chapter) {
      throw new NotFoundException({ code: "chapter_not_found", message: "Chapter not found." });
    }
    return chapter;
  }

  listPublishedBySeries(seriesId: string) {
    return this.repo.listPublishedBySeries(seriesId);
  }

  /** Used by the bot-integration lookup route only — a plain read, no role check, gated entirely by ServiceKeyGuard at the controller. */
  findBySeriesAndNumber(seriesId: string, number: number) {
    return this.repo.findBySeriesAndNumber(seriesId, number);
  }

  async listRecentForAdmin(role: string) {
    this.assertCanPublish(role);
    return this.repo.listRecent(50);
  }

  async update(role: string, id: string, patch: { isPublished?: boolean; manualLock?: boolean | null }) {
    this.assertCanPublish(role);
    const before = await this.get(id);
    const publishing = patch.isPublished === true && !before.isPublished;
    const unpublishing = patch.isPublished === false && before.isPublished;
    // The catalogue's "latest chapters" (and each work's and team's last update) go by the publication time, so going live
    // stamps it and taking a chapter down clears it — without it a chapter published here sorted after every imported one.
    const stamp = publishing ? { publishedAt: new Date() } : unpublishing ? { publishedAt: null } : {};
    const updated = await this.repo.update(id, { ...patch, ...stamp });
    this.catalog.invalidate(); // the home page and the work's page show the change at once, not after the cache runs out
    // Going live is what readers who follow the series want to hear about (never for a chapter already live).
    if (publishing) void this.notifications.chapterPublished(before.seriesId, before.number);
    return updated;
  }

  async remove(role: string, id: string) {
    this.assertCanPublish(role);
    await this.get(id);
    const removed = await this.repo.delete(id);
    this.catalog.invalidate();
    return removed;
  }

  /**
   * Validate → normalize (re-encode WebP, which also strips EXIF) →
   * checksum → store under a random key → link as a page. Rejects a
   * duplicate page number outright rather than silently overwriting — an
   * admin fixing a mistake deletes the chapter and starts over, which is an
   * acceptable v1 limitation for how rarely a single page needs replacing.
   * One picture is one page here (the bot's route uses this one).
   */
  async uploadPage(role: string, chapterId: string, pageNumber: number, file: Express.Multer.File | undefined) {
    this.assertCanPublish(role);
    await this.get(chapterId);

    if (!file) {
      throw new BadRequestException({ code: "missing_file", message: "No image file was uploaded." });
    }
    return this.storePage(chapterId, pageNumber, file.buffer);
  }

  /**
   * The admin upload: like {@link uploadPage}, but a long picture (a webtoon strip) is cut into several pages and a very
   * wide one is shrunk. Answers how many pages the picture became, so the caller numbers the next one after them.
   */
  async uploadPages(role: string, chapterId: string, firstPage: number, file: Express.Multer.File | undefined) {
    this.assertCanPublish(role);
    await this.get(chapterId);

    if (!file) {
      throw new BadRequestException({ code: "missing_file", message: "No image file was uploaded." });
    }
    return this.storePages(chapterId, firstPage, file.buffer);
  }

  /** The permission check the callers of {@link storePage} that are not a request (the Drive import) make up front. */
  requirePublisher(role: string) {
    this.assertCanPublish(role);
  }

  /** Normalizes the picture and links it as the chapter's page `pageNumber` (the chapter and the caller's right to publish are checked by the caller). */
  async storePage(chapterId: string, pageNumber: number, bytes: Buffer) {
    const [page] = await this.storeSlices(chapterId, pageNumber, await this.prepare(bytes, false));
    return page;
  }

  /**
   * Turns the picture into WebP and links it from page `firstPage` on: one page, or — for a picture taller than a page can
   * be — the pieces it was cut into, one page each in order. Returns how many pages it made.
   */
  async storePages(chapterId: string, firstPage: number, bytes: Buffer): Promise<{ pages: number }> {
    const created = await this.storeSlices(chapterId, firstPage, await this.prepare(bytes, true));
    return { pages: created.length };
  }

  private async prepare(bytes: Buffer, cut: boolean): Promise<PageSlice[]> {
    try {
      return await preparePage(bytes, { cut });
    } catch (err) {
      if (err instanceof PageImageError) throw new BadRequestException({ code: err.code, message: err.message });
      throw err;
    }
  }

  private async storeSlices(chapterId: string, firstPage: number, slices: PageSlice[]) {
    // Every number is checked before the first piece is stored, so a clash leaves nothing half-linked.
    for (let i = 0; i < slices.length; i++) {
      if (await this.repo.findPage(chapterId, firstPage + i)) {
        throw new ConflictException({ code: "page_number_taken", message: `Page ${firstPage + i} already exists for this chapter.` });
      }
    }

    const pages = [];
    for (const [i, slice] of slices.entries()) {
      const storageKey = `chapters/${randomUUID()}.webp`;
      const { checksum } = await this.storage.put(storageKey, slice.data);
      const asset = await this.repo.createAsset({ storageKey, checksum, mimeType: "image/webp", width: slice.width, height: slice.height });
      pages.push(await this.repo.createPage({ chapterId, pageNumber: firstPage + i, assetId: asset.id }));
    }
    return pages;
  }

  /** May this member read the chapter now? Free, opened with a credit or coins, or staff — decided by the wallet (modules/wallet). */
  async canAccessChapter(userId: string | null, chapterId: string): Promise<boolean> {
    return (await this.wallet.access(userId, chapterId)).canRead;
  }

  /** `userId` is null for a visitor without an account: pages of a chapter that is not locked are issued to them too, a locked one never is. */
  async issuePageToken(
    userId: string | null,
    chapterId: string,
    pageNumber: number,
    ctx: RequestContext
  ): Promise<IssuedImageToken> {
    const allowed = await this.canAccessChapter(userId, chapterId);
    if (!allowed) {
      throw new ForbiddenException({ code: "chapter_locked", message: "This chapter is locked for your account." });
    }
    const chapter = await this.get(chapterId);
    const page = chapter.pages.find((p) => p.pageNumber === pageNumber);
    if (!page) {
      throw new NotFoundException({ code: "page_not_found", message: "Page not found in this chapter." });
    }
    return this.images.issueToken(page.assetId, userId ?? GUEST_READER, ctx);
  }

  /** Opens a locked chapter by spending a reading credit or coins (a chapter that needs no payment costs nothing). */
  unlock(userId: string, chapterId: string, method: UnlockMethod) {
    return this.wallet.unlockChapter(userId, chapterId, method);
  }
}
