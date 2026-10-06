import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { CatalogService } from "../catalog/catalog.service";
import { ImagesService, type IssuedImageToken } from "../images/images.service";
import { StorageService } from "../images/storage/storage.interface";
import type { RequestContext } from "../../common/middleware/request-context.middleware";
import { WalletService } from "../wallet/wallet.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AnnouncementsService } from "../announcements/announcements.service";
import { TeamActivityService } from "../team-activity/team-activity.service";
import { canPublishAt, TeamAccessService, type TeamLevel } from "../team-access/team-access.service";
import type { UnlockMethod } from "../wallet/wallet.repository";
import { ChaptersRepository } from "./chapters.repository";
import { PageImageError, preparePage, type PageSlice } from "./page-image.util";

/**
 * The site's own staff: these global roles work on any series' chapters (mirrors the frontend's rbac.ts GLOBAL_ROLE_PERMISSIONS —
 * duplicated deliberately, not imported, since the two apps don't share a types package).
 *
 * Everyone else gets in through their place in the team that owns the series (see TeamAccessService): the team's leaders may do
 * everything with its chapters, a publisher may upload and put them live, an uploader may only upload. A team that collaborates on
 * the series (its collaboration request was accepted) works the same way, but only on the chapters it uploaded itself: each chapter
 * is credited to the team that made it.
 */
const CAN_PUBLISH_GLOBAL_ROLES = new Set(["uploader", "editor", "super_administrator", "owner"]);

/** Who is asking. `id` is null for the Telegram/Discord bot, which acts with a site role and no account. */
export interface ChapterActor {
  id: string | null;
  role: string;
}

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
    private readonly catalog: CatalogService,
    private readonly activity: TeamActivityService,
    private readonly announcements: AnnouncementsService,
    private readonly teamAccess: TeamAccessService
  ) {}

  private isStaff(actor: ChapterActor): boolean {
    return CAN_PUBLISH_GLOBAL_ROLES.has(actor.role);
  }

  private forbidden(): never {
    throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot publish chapters." });
  }

  /**
   * The actor's place for this work, or null (not in a team working on it, the team is not active, the series has no team, or the
   * actor is the bot). The team that owns the series comes first and covers every chapter. Otherwise a collaborating team: for a new
   * chapter (`chapterTeamId` left out) any of them, for an existing one only the team the chapter is credited to.
   */
  private async standing(actor: ChapterActor, seriesId: string, chapterTeamId?: string | null): Promise<{ teamId: string; level: TeamLevel } | null> {
    if (!actor.id) return null;
    const series = await this.repo.seriesAccess(seriesId);
    if (!series?.teamId) return null;
    const level = await this.teamAccess.levelFor(actor.id, series.teamId);
    if (level) return { teamId: series.teamId, level };
    if (chapterTeamId === null) return null;
    const collaborators = chapterTeamId === undefined ? await this.repo.collaboratorTeamIds(seriesId) : (await this.repo.collaboratorTeamIds(seriesId)).filter((id) => id === chapterTeamId);
    for (const teamId of collaborators) {
      const collaboratorLevel = await this.teamAccess.levelFor(actor.id, teamId);
      if (collaboratorLevel) return { teamId, level: collaboratorLevel };
    }
    return null;
  }

  /** Works on these chapters: the site's staff, the team that owns the series (any level), or the collaborating team the chapter is credited to. */
  private async assertCanUpload(actor: ChapterActor, seriesId: string, chapterTeamId?: string | null) {
    if (this.isStaff(actor)) return;
    if (!(await this.standing(actor, seriesId, chapterTeamId))) this.forbidden();
  }

  /** Puts a chapter live or takes it down: staff, or a lead or a publisher of a team that may work on it (see {@link standing}). */
  private async assertCanPublish(actor: ChapterActor, seriesId: string, chapterTeamId?: string | null) {
    if (this.isStaff(actor)) return;
    const standing = await this.standing(actor, seriesId, chapterTeamId);
    if (!standing || !canPublishAt(standing.level)) this.forbidden();
  }

  /** The chapter, once the actor is allowed to work on it. The Drive import and the featured picture check through this too. */
  async requireUploader(actor: ChapterActor, chapterId: string) {
    const chapter = await this.get(chapterId);
    await this.assertCanUpload(actor, chapter.seriesId, chapter.teamId);
    return chapter;
  }

  /** For the routes that are not about one series (the Drive import's set-up details): staff, or anyone who works on a team's chapters. */
  async requireAnyUploader(actor: ChapterActor) {
    if (this.isStaff(actor)) return;
    if (!actor.id || (await this.teamAccess.accessFor(actor.id)).length === 0) this.forbidden();
  }

  /**
   * `teamId` may be left out for the site's staff: a work that belongs to no team is published by them on its own. A team's people
   * never choose the team — the chapter takes the one that owns the series (or, for a collaborating team, theirs), whatever the
   * request says.
   */
  async create(actor: ChapterActor, dto: { seriesId: string; teamId?: string; number: number; title: string }) {
    let teamId = dto.teamId?.trim() || null;
    if (!this.isStaff(actor)) {
      const standing = await this.standing(actor, dto.seriesId);
      if (!standing) this.forbidden();
      teamId = standing.teamId;
    }
    return this.repo.create({ seriesId: dto.seriesId, teamId, number: dto.number, title: dto.title });
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

  /** The staff see every chapter; a team's people see only the chapters of the series their team owns. */
  async listRecentForAdmin(actor: ChapterActor) {
    if (this.isStaff(actor)) return this.repo.listRecent(50);
    const teams = actor.id ? await this.teamAccess.accessFor(actor.id) : [];
    if (teams.length === 0) this.forbidden();
    // the chapters of the works the teams own, and the ones they made for another team's work as collaborators
    return this.repo.listRecent(50, teams.map((team) => team.teamId));
  }

  async update(actor: ChapterActor, id: string, patch: { isPublished?: boolean; manualLock?: boolean | null; title?: string; number?: number }) {
    const before = await this.get(id);
    if (patch.manualLock !== undefined && !this.isStaff(actor)) this.forbidden(); // the lock decides what costs coins — the site's call, not a team's
    if (patch.isPublished !== undefined) await this.assertCanPublish(actor, before.seriesId, before.teamId);
    else await this.assertCanUpload(actor, before.seriesId, before.teamId);
    // The title and number are corrected by anyone who works on the chapters (checked just above); a number may not clash with another chapter of the work.
    if (patch.title !== undefined) patch = { ...patch, title: patch.title.trim() };
    if (patch.title === "") throw new BadRequestException({ code: "invalid_title", message: "The chapter needs a title." });
    if (patch.number !== undefined && patch.number !== before.number) {
      const clash = await this.repo.findBySeriesAndNumber(before.seriesId, patch.number);
      if (clash && clash.id !== id) throw new ConflictException({ code: "chapter_number_taken", message: `Chapter ${patch.number} already exists for this series.` });
    }
    const publishing = patch.isPublished === true && !before.isPublished;
    const unpublishing = patch.isPublished === false && before.isPublished;
    // A work still waiting for the site's approval is not shown anywhere, so none of its chapters may go live yet.
    if (publishing && (await this.repo.seriesAccess(before.seriesId))?.state !== "approved") {
      throw new ConflictException({ code: "series_not_approved", message: "The series has not been approved yet, so its chapters cannot go live." });
    }
    // The catalogue's "latest chapters" (and each work's and team's last update) go by the publication time, so going live
    // stamps it and taking a chapter down clears it — without it a chapter published here sorted after every imported one.
    const stamp = publishing ? { publishedAt: new Date() } : unpublishing ? { publishedAt: null } : {};
    const updated = await this.repo.update(id, { ...patch, ...stamp });
    this.catalog.invalidate(); // the home page and the work's page show the change at once, not after the cache runs out
    if ((publishing || unpublishing) && before.teamId) {
      const series = await this.repo.seriesTitle(before.seriesId);
      await this.activity.record(before.teamId, publishing ? "chapter_published" : "chapter_unpublished", { actorId: actor.id ?? undefined, detail: `${before.number} من ${series ?? "أحد الأعمال"}` });
    }
    // Going live is what readers who follow the series want to hear about (never for a chapter already live).
    if (publishing) void this.notifications.chapterPublished(before.seriesId, before.number);
    // ... and the outside world (Discord, Telegram, Bing): only for a chapter that is live now, not one scheduled for later.
    if (publishing && !(before.scheduledFor && before.scheduledFor.getTime() > Date.now())) this.announcements.chapterPublished(before.seriesId, before.number);
    return updated;
  }

  /** Deleting a chapter is for the site's staff and the team's leads — a publisher or an uploader can take it down, not remove it. */
  async remove(actor: ChapterActor, id: string) {
    const chapter = await this.get(id);
    if (!this.isStaff(actor) && (await this.standing(actor, chapter.seriesId, chapter.teamId))?.level !== "lead") this.forbidden();
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
  async uploadPage(actor: ChapterActor, chapterId: string, pageNumber: number, file: Express.Multer.File | undefined) {
    await this.requireUploader(actor, chapterId);

    if (!file) {
      throw new BadRequestException({ code: "missing_file", message: "No image file was uploaded." });
    }
    return this.storePage(chapterId, pageNumber, file.buffer);
  }

  /**
   * Puts a new picture in place of page `pageNumber` — a page that was wrong, blurry or badly typeset — without redoing the
   * chapter. Same chapter, same number; one picture is one page (a strip is not cut, or the numbers after it would shift). The
   * old picture stays in storage, but no reader is sent to it once this returns.
   */
  async replacePage(actor: ChapterActor, chapterId: string, pageNumber: number, file: Express.Multer.File | undefined) {
    await this.requireUploader(actor, chapterId);
    if (!file) {
      throw new BadRequestException({ code: "missing_file", message: "No image file was uploaded." });
    }
    if (!(await this.repo.findPage(chapterId, pageNumber))) {
      throw new NotFoundException({ code: "page_not_found", message: "Page not found in this chapter." });
    }
    const [slice] = await this.prepare(file.buffer, false);
    const storageKey = `chapters/${randomUUID()}.webp`;
    const { checksum } = await this.storage.put(storageKey, slice.data);
    const asset = await this.repo.createAsset({ storageKey, checksum, mimeType: "image/webp", width: slice.width, height: slice.height });
    await this.repo.updatePageAsset(chapterId, pageNumber, asset.id);
    return { pageNumber };
  }

  /**
   * The admin upload: like {@link uploadPage}, but a long picture (a webtoon strip) is cut into several pages and a very
   * wide one is shrunk. Answers how many pages the picture became, so the caller numbers the next one after them.
   */
  async uploadPages(actor: ChapterActor, chapterId: string, firstPage: number, file: Express.Multer.File | undefined) {
    await this.requireUploader(actor, chapterId);

    if (!file) {
      throw new BadRequestException({ code: "missing_file", message: "No image file was uploaded." });
    }
    return this.storePages(chapterId, firstPage, file.buffer);
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

  /**
   * The picture's part of {@link storePages} that needs no database: turned into WebP pages (a long one cut). The import prepares
   * several pictures side by side with it, then links them in reading order with {@link storePrepared}.
   */
  preparePages(bytes: Buffer): Promise<PageSlice[]> {
    return this.prepare(bytes, true);
  }

  /** Links pages made by {@link preparePages} from page `firstPage` on. Returns how many pages it made. */
  async storePrepared(chapterId: string, firstPage: number, slices: PageSlice[]): Promise<{ pages: number }> {
    const created = await this.storeSlices(chapterId, firstPage, slices);
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

  /**
   * Takes page `pageNumber` out of the chapter and moves the pages after it up by one, so the reading order has no gap — for a page
   * that should not be there (a duplicate, a credits page from another group). The last page cannot go: delete the chapter instead.
   */
  async removePage(actor: ChapterActor, chapterId: string, pageNumber: number) {
    const chapter = await this.requireUploader(actor, chapterId);
    if (!chapter.pages.some((page) => page.pageNumber === pageNumber)) {
      throw new NotFoundException({ code: "page_not_found", message: "Page not found in this chapter." });
    }
    if (chapter.pages.length <= 1) {
      throw new BadRequestException({ code: "last_page", message: "A chapter needs at least one page; delete the chapter instead." });
    }
    await this.repo.deletePageAndClose(chapterId, pageNumber);
    this.catalog.invalidate();
    return { pages: chapter.pages.length - 1 };
  }

  /** Swaps two pages — how a page is moved one place up or down while the chapter is checked before publishing. */
  async swapPages(actor: ChapterActor, chapterId: string, a: number, b: number) {
    const chapter = await this.requireUploader(actor, chapterId);
    const first = chapter.pages.find((page) => page.pageNumber === a);
    const second = chapter.pages.find((page) => page.pageNumber === b);
    if (!first || !second) throw new NotFoundException({ code: "page_not_found", message: "Page not found in this chapter." });
    if (a === b) return { swapped: false };
    await this.repo.swapPageNumbers(chapterId, a, b);
    return { swapped: true };
  }

  /** Works on this chapter: the site's staff, anyone in the team that owns the series, or in the collaborating team that made it. */
  private async worksOn(actor: ChapterActor | null, chapter: { seriesId: string; teamId: string | null }): Promise<boolean> {
    if (!actor) return false;
    if (this.isStaff(actor)) return true;
    return Boolean(await this.standing(actor, chapter.seriesId, chapter.teamId));
  }

  /** May this member read the chapter now? Free, opened with a credit or coins, or staff — decided by the wallet (modules/wallet). */
  async canAccessChapter(userId: string | null, chapterId: string): Promise<boolean> {
    return (await this.wallet.access(userId, chapterId)).canRead;
  }

  /** `userId` is null for a visitor without an account: pages of a chapter that is not locked are issued to them too, a locked one never is. */
  async issuePageToken(
    actor: ChapterActor | null,
    chapterId: string,
    pageNumber: number,
    ctx: RequestContext
  ): Promise<IssuedImageToken> {
    const userId = actor?.id ?? null;
    const chapter = await this.get(chapterId);
    // Readers go by the wallet. Only when it refuses — a locked chapter, or a draft, which to the wallet does not exist at all — is the
    // team asked about: it checks its own chapter before readers do, without paying for it (and a reader pays no extra lookup).
    let refusal: unknown = null;
    const allowed = await this.canAccessChapter(userId, chapterId).catch((err: unknown) => ((refusal = err), false));
    if (!allowed && !(await this.worksOn(actor, chapter))) {
      throw refusal ?? new ForbiddenException({ code: "chapter_locked", message: "This chapter is locked for your account." });
    }
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
