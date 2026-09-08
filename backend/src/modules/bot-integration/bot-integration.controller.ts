import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { memoryStorage } from "multer";
import { Public } from "../../common/decorators/public.decorator";
import { ServiceKeyGuard } from "../../common/guards/service-key.guard";
import { ChaptersService } from "../chapters/chapters.service";
import { CreateChapterDto } from "../chapters/dto/create-chapter.dto";
import { UpdateChapterDto } from "../chapters/dto/update-chapter.dto";
import { UploadPageDto } from "../chapters/dto/upload-page.dto";

const MAX_PAGE_UPLOAD_BYTES = 15 * 1024 * 1024;

/**
 * Machine-to-machine only — the Discord bot pushing a finished chapter's
 * images once a team lead marks it published on its own internal board.
 * No human actor, so no JWT: every route here is @Public() (skips the
 * global JwtAuthGuard) and gated instead by ServiceKeyGuard. The bot has no
 * account of its own — "uploader" is hardcoded when calling into
 * ChaptersService, since ServiceKeyGuard is what actually authorizes these
 * calls, not the role string itself.
 */
@Public()
@UseGuards(ServiceKeyGuard)
@Controller("v1/integrations/bot/chapters")
export class BotIntegrationController {
  constructor(private readonly chapters: ChaptersService) {}

  /** Lets a retried/resumed push find a chapter it already created, regardless of publish state, instead of blindly re-POSTing into the seriesId+number unique constraint. */
  @Get("lookup")
  async lookup(@Query("seriesId") seriesId?: string, @Query("number") numberRaw?: string) {
    if (!seriesId || !numberRaw) {
      throw new BadRequestException({ code: "missing_query_params", message: "seriesId and number are required." });
    }
    const number = Number(numberRaw);
    if (!Number.isFinite(number)) {
      throw new BadRequestException({ code: "invalid_number", message: "number must be numeric." });
    }
    const chapter = await this.chapters.findBySeriesAndNumber(seriesId, number);
    if (!chapter) {
      throw new NotFoundException({ code: "chapter_not_found", message: "No chapter for this series/number yet." });
    }
    return chapter;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  create(@Body() dto: CreateChapterDto) {
    return this.chapters.create("uploader", dto);
  }

  @Post(":id/pages")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: MAX_PAGE_UPLOAD_BYTES } }))
  uploadPage(
    @Param("id") chapterId: string,
    @Body() dto: UploadPageDto,
    @UploadedFile() file: Express.Multer.File | undefined
  ) {
    return this.chapters.uploadPage("uploader", chapterId, dto.pageNumber, file);
  }

  @Patch(":id")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  update(@Param("id") id: string, @Body() dto: UpdateChapterDto) {
    return this.chapters.update("uploader", id, dto);
  }
}
