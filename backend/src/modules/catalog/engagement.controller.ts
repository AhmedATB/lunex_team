import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { SetRatingDto } from "./dto/rating.dto";
import { EngagementService } from "./engagement.service";

/**
 * Signed-in readers only (no @Public()). Not limited per IP: the limiter sees the whole site as one IP behind the
 * frontend (§24), and these are one-row writes that are already de-duplicated per reader.
 */
@SkipThrottle()
@Controller("v1/catalog")
export class EngagementController {
  constructor(private readonly engagement: EngagementService) {}

  /** Called once when a reader opens a chapter. A repeat the same day answers `counted: false`. */
  @Post("chapters/:chapterId/view")
  @HttpCode(HttpStatus.OK)
  view(@Param("chapterId") chapterId: string, @CurrentUser() user: AccessTokenPayload) {
    return this.engagement.recordView(user.sub, chapterId);
  }

  @Get("series/:seriesId/rating")
  @HttpCode(HttpStatus.OK)
  rating(@Param("seriesId") seriesId: string, @CurrentUser() user: AccessTokenPayload) {
    return this.engagement.rating(user.sub, seriesId);
  }

  @Put("series/:seriesId/rating")
  @HttpCode(HttpStatus.OK)
  setRating(@Param("seriesId") seriesId: string, @Body() dto: SetRatingDto, @CurrentUser() user: AccessTokenPayload) {
    return this.engagement.setRating(user.sub, seriesId, dto.value);
  }

  @Delete("series/:seriesId/rating")
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearRating(@Param("seriesId") seriesId: string, @CurrentUser() user: AccessTokenPayload) {
    await this.engagement.clearRating(user.sub, seriesId);
  }
}
