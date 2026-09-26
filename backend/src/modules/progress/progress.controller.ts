import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { CompleteChapterDto } from "./dto/complete-chapter.dto";
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
}
