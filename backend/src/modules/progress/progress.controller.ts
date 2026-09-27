import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Post, Put, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { CompleteChapterDto } from "./dto/complete-chapter.dto";
import { SavePositionDto } from "./dto/save-position.dto";
import { ProgressService } from "./progress.service";

/** A reader's own progression. Signed-in only (no @Public()); it only ever describes the caller. */
@Controller("v1/me")
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get("progress")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  get(@CurrentUser() user: AccessTokenPayload) {
    return this.progress.snapshot(user.sub);
  }

  /** The reader reached the end of a chapter; the server checks it was opened, and for long enough, before it pays out. */
  @Post("reading/complete")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  complete(@Body() dto: CompleteChapterDto, @CurrentUser() user: AccessTokenPayload) {
    return this.progress.completeChapter(user.sub, dto.chapterId);
  }

  /** A ping every so often while a chapter is open, so leaving mid-way and coming back resumes at the same spot. */
  @Put("reading/position")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 90, ttl: 60_000 } })
  async savePosition(@Body() dto: SavePositionDto, @CurrentUser() user: AccessTokenPayload) {
    await this.progress.savePosition(user.sub, dto.chapterId, dto.fraction);
    return { ok: true };
  }

  /** Where to resume this one chapter, when its page opens. */
  @Get("reading/position")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  position(@Query("chapterId") chapterId: string | undefined, @CurrentUser() user: AccessTokenPayload) {
    if (!chapterId) throw new BadRequestException({ code: "missing_chapter_id", message: "chapterId is required." });
    return this.progress.position(user.sub, chapterId);
  }

  /** Every chapter of one work the reader has touched — the chapter list's checkmarks and in-progress bars. */
  @Get("reading/progress")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  seriesProgress(@Query("seriesId") seriesId: string | undefined, @CurrentUser() user: AccessTokenPayload) {
    if (!seriesId) throw new BadRequestException({ code: "missing_series_id", message: "seriesId is required." });
    return this.progress.seriesProgress(user.sub, seriesId);
  }
}
