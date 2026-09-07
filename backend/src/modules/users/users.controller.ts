import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { memoryStorage } from "multer";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { ChangeRoleDto } from "./dto/change-role.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UsersService } from "./users.service";

const MAX_AVATAR_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Only `:id/avatar` below is @Public() — everything else requires a valid access token via the global JwtAuthGuard, and UsersService independently re-checks the actor's actual DB role before allowing anything. */
@Controller("v1/users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch(":id/role")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  changeRole(
    @Param("id") id: string,
    @Body() dto: ChangeRoleDto,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() req: Request
  ) {
    return this.users.changeRole(actor.sub, id, dto.role, req.context);
  }

  /** A user editing their own profile — actor.sub is the target, never a caller-supplied id. */
  @Patch("me")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  updateProfile(@Body() dto: UpdateProfileDto, @CurrentUser() actor: AccessTokenPayload, @Req() req: Request) {
    return this.users.updateProfile(actor.sub, dto, req.context);
  }

  /** memoryStorage — the file must reach UsersService as a Buffer (for sharp + the DB column), never written to Railway's ephemeral local disk. */
  @Post("me/avatar")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: MAX_AVATAR_UPLOAD_BYTES } }))
  uploadAvatar(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() req: Request
  ) {
    return this.users.uploadAvatar(actor.sub, file, req.context);
  }

  /**
   * @Public() deliberately — an avatar is exactly as visible as any other
   * public-profile detail (displayName, bio), viewable by anyone browsing
   * someone else's profile, logged in or not. Unlike the manga-page image
   * pipeline (ImagesService), there's no per-viewer token/watermark here:
   * this is a plain cacheable image, not something being protected from
   * scraping.
   */
  @Public()
  @Get(":id/avatar")
  @HttpCode(HttpStatus.OK)
  async getAvatar(@Param("id") id: string, @Res() res: Response) {
    const avatar = await this.users.getAvatarBytes(id);
    if (!avatar) {
      throw new NotFoundException({ code: "avatar_not_found", message: "No avatar set for this user." });
    }
    res.setHeader("Content-Type", avatar.mimeType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(avatar.buffer);
  }
}
