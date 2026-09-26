import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { memoryStorage } from "multer";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { ChapterImportService } from "./chapter-import.service";
import { ChaptersService } from "./chapters.service";
import { ImportDriveDto } from "./dto/import-drive.dto";
import { CreateChapterDto } from "./dto/create-chapter.dto";
import { UpdateChapterDto } from "./dto/update-chapter.dto";
import { UploadPageDto } from "./dto/upload-page.dto";
import { UnlockChapterDto } from "../wallet/dto/unlock-chapter.dto";

const MAX_PAGE_UPLOAD_BYTES = 15 * 1024 * 1024;

/**
 * Every route here requires a real auth token (global JwtAuthGuard) except
 * the two marked @Public() — those return chapter/page METADATA only (ids,
 * numbers, titles), never image bytes. Actual page bytes only ever flow
 * through the token-gated /v1/images/:assetId/stream route, unchanged.
 */
@Controller("v1/chapters")
export class ChaptersController {
  constructor(
    private readonly chapters: ChaptersService,
    private readonly imports: ChapterImportService
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  create(@Body() dto: CreateChapterDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.chapters.create(actor.role, dto);
  }

  @Get("admin/recent")
  listRecentForAdmin(@CurrentUser() actor: AccessTokenPayload) {
    return this.chapters.listRecentForAdmin(actor.role);
  }

  @Public()
  @Get()
  listPublished(@Query("seriesId") seriesId?: string) {
    if (!seriesId) {
      throw new NotFoundException({ code: "series_id_required", message: "seriesId query param is required." });
    }
    return this.chapters.listPublishedBySeries(seriesId);
  }

  @Public()
  @Get(":id")
  get(@Param("id") id: string) {
    return this.chapters.get(id);
  }

  @Patch(":id")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  update(@Param("id") id: string, @Body() dto: UpdateChapterDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.chapters.update(actor.role, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async remove(@Param("id") id: string, @CurrentUser() actor: AccessTokenPayload) {
    await this.chapters.remove(actor.role, id);
  }

  @Post(":id/pages")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: MAX_PAGE_UPLOAD_BYTES } }))
  uploadPage(
    @Param("id") chapterId: string,
    @Body() dto: UploadPageDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: AccessTokenPayload
  ) {
    return this.chapters.uploadPage(actor.role, chapterId, dto.pageNumber, file);
  }

  /**
   * The real caller a reader uses — checks chapter authorization, THEN delegates to ImagesService for the actual token
   * mechanics. Open to visitors without an account: a chapter that is not locked is readable by anyone (the wallet says so),
   * a locked one is refused with 403 to anyone who has not opened it.
   */
  @Public()
  @Post(":id/pages/:pageNumber/token")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  issuePageToken(
    @Param("id") chapterId: string,
    @Param("pageNumber") pageNumber: string,
    @CurrentUser() actor: AccessTokenPayload | undefined,
    @Req() req: Request
  ) {
    return this.chapters.issuePageToken(actor?.sub ?? null, chapterId, Number(pageNumber), req.context);
  }

  /** Whether Drive import is set up, and the address a private folder must be shared with. */
  @Get("import/drive/info")
  driveInfo() {
    return this.imports.driveInfo();
  }

  /**
   * Starts pulling the page images of a Google Drive folder into this chapter. It answers at once (with how many images it
   * found); the pages are fetched in the background and `GET :id/import/status` reports progress.
   */
  @Post(":id/import/drive")
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  importDrive(@Param("id") chapterId: string, @Body() dto: ImportDriveDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.imports.startDrive(actor.role, chapterId, dto.link);
  }

  @Get(":id/import/status")
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  importStatus(@Param("id") chapterId: string, @CurrentUser() actor: AccessTokenPayload) {
    this.chapters.requirePublisher(actor.role);
    return this.imports.status(chapterId);
  }

  @Post(":id/unlock")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  unlock(@Param("id") chapterId: string, @Body() dto: UnlockChapterDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.chapters.unlock(actor.sub, chapterId, dto.method);
  }
}
