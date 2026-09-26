import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { ImagesService, type IssuedImageToken } from "../images/images.service";
import { StorageService } from "../images/storage/storage.interface";
import type { RequestContext } from "../../common/middleware/request-context.middleware";
import { WalletService } from "../wallet/wallet.service";
import type { UnlockMethod } from "../wallet/wallet.repository";
import { ChaptersRepository } from "./chapters.repository";

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

const MAX_PAGE_DIMENSION = 6000;

@Injectable()
export class ChaptersService {
  constructor(
    private readonly repo: ChaptersRepository,
    private readonly storage: StorageService,
    private readonly images: ImagesService,
    private readonly wallet: WalletService
  ) {}

  private assertCanPublish(role: string) {
    if (!CAN_PUBLISH_GLOBAL_ROLES.has(role)) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot publish chapters." });
    }
  }

  async create(role: string, dto: { seriesId: string; teamId: string; number: number; title: string }) {
    this.assertCanPublish(role);
    return this.repo.create(dto);
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
    await this.get(id);
    return this.repo.update(id, patch);
  }

  async remove(role: string, id: string) {
    this.assertCanPublish(role);
    await this.get(id);
    return this.repo.delete(id);
  }

  /**
   * Validate → normalize (re-encode WebP, which also strips EXIF) →
   * checksum → store under a random key → link as a page. Rejects a
   * duplicate page number outright rather than silently overwriting — an
   * admin fixing a mistake deletes the chapter and starts over, which is an
   * acceptable v1 limitation for how rarely a single page needs replacing.
   */
  async uploadPage(role: string, chapterId: string, pageNumber: number, file: Express.Multer.File | undefined) {
    this.assertCanPublish(role);
    await this.get(chapterId);

    if (!file) {
      throw new BadRequestException({ code: "missing_file", message: "No image file was uploaded." });
    }

    const existing = await this.repo.findPage(chapterId, pageNumber);
    if (existing) {
      throw new ConflictException({
        code: "page_number_taken",
        message: `Page ${pageNumber} already exists for this chapter.`,
      });
    }

    let normalized: Buffer;
    let width: number;
    let height: number;
    try {
      const image = sharp(file.buffer);
      const metadata = await image.metadata();
      width = metadata.width ?? 0;
      height = metadata.height ?? 0;
      if (!width || !height) throw new Error("no dimensions");
      if (width > MAX_PAGE_DIMENSION || height > MAX_PAGE_DIMENSION) {
        throw new BadRequestException({ code: "image_too_large", message: "Page image dimensions exceed the allowed maximum." });
      }
      normalized = await image.webp({ quality: 90 }).toBuffer();
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException({ code: "invalid_image", message: "This file could not be read as an image." });
    }

    const storageKey = `chapters/${randomUUID()}.webp`;
    const { checksum } = await this.storage.put(storageKey, normalized);
    const asset = await this.repo.createAsset({ storageKey, checksum, mimeType: "image/webp", width, height });
    return this.repo.createPage({ chapterId, pageNumber, assetId: asset.id });
  }

  /** May this member read the chapter now? Free, opened with a credit or coins, or staff — decided by the wallet (modules/wallet). */
  async canAccessChapter(userId: string, chapterId: string): Promise<boolean> {
    return (await this.wallet.access(userId, chapterId)).canRead;
  }

  async issuePageToken(
    userId: string,
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
    return this.images.issueToken(page.assetId, userId, ctx);
  }

  /** Opens a locked chapter by spending a reading credit or coins (a chapter that needs no payment costs nothing). */
  unlock(userId: string, chapterId: string, method: UnlockMethod) {
    return this.wallet.unlockChapter(userId, chapterId, method);
  }
}
