import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { SetProgressDto, SyncLibraryDto } from "./dto/progress.dto";
import { UpdatePrivacyDto } from "./dto/update-privacy.dto";
import { ProfilesService } from "./profiles.service";

/**
 * `me/...` routes come first and are all authenticated — actor.sub is the
 * account being changed, never a caller-supplied id. The single-segment
 * `:username` route is the only public one; the guard still attaches the
 * caller's identity when a valid token is sent, which is how a "members only"
 * section knows the viewer is signed in. (No username can be `me`: usernames
 * are at least 3 characters.)
 */
@Controller("v1/profiles")
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get("me/library")
  @HttpCode(HttpStatus.OK)
  library(@CurrentUser() actor: AccessTokenPayload) {
    return this.profiles.getLibrary(actor.sub);
  }

  @Post("me/library/sync")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  sync(@Body() dto: SyncLibraryDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.profiles.syncLibrary(actor.sub, dto);
  }

  @Put("me/bookmarks/:seriesId")
  @HttpCode(HttpStatus.NO_CONTENT)
  addBookmark(@Param("seriesId") seriesId: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.profiles.addBookmark(actor.sub, seriesId);
  }

  @Delete("me/bookmarks/:seriesId")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeBookmark(@Param("seriesId") seriesId: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.profiles.removeBookmark(actor.sub, seriesId);
  }

  @Put("me/progress/:seriesId")
  @HttpCode(HttpStatus.NO_CONTENT)
  setProgress(
    @Param("seriesId") seriesId: string,
    @Body() dto: SetProgressDto,
    @CurrentUser() actor: AccessTokenPayload
  ) {
    return this.profiles.setProgress(actor.sub, seriesId, dto.chapterNumber);
  }

  @Patch("me/privacy")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  updatePrivacy(@Body() dto: UpdatePrivacyDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.profiles.updatePrivacy(actor.sub, dto);
  }

  @Public()
  @Get(":username")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  getProfile(@Param("username") username: string, @CurrentUser() viewer: AccessTokenPayload | undefined) {
    return this.profiles.getProfile(username, viewer ? { id: viewer.sub } : undefined);
  }
}
