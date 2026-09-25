import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { memoryStorage } from "multer";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { CatalogAdminService } from "./catalog-admin.service";
import {
  CreateNewsDto,
  CreateSeriesDto,
  CreateTagDto,
  CreateTeamDto,
  SetMemberDto,
  UpdateNewsDto,
  UpdateSeriesDto,
  UpdateTeamDto,
} from "./dto/catalog.dto";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const imageUpload = () => FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES } });

/** Authenticated (the global guard) and role-checked per method inside CatalogAdminService against the account's CURRENT role. */
@Controller("v1/catalog")
export class CatalogAdminController {
  constructor(private readonly admin: CatalogAdminService) {}

  // ---- series ----

  @Post("series")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  createSeries(@Body() dto: CreateSeriesDto, @CurrentUser() actor: AccessTokenPayload, @Req() req: Request) {
    return this.admin.createSeries(actor.sub, dto, req.context);
  }

  @Patch("series/:id")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  updateSeries(@Param("id") id: string, @Body() dto: UpdateSeriesDto, @CurrentUser() actor: AccessTokenPayload, @Req() req: Request) {
    return this.admin.updateSeries(actor.sub, id, dto, req.context);
  }

  @Delete("series/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  deleteSeries(@Param("id") id: string, @CurrentUser() actor: AccessTokenPayload, @Req() req: Request) {
    return this.admin.deleteSeries(actor.sub, id, req.context);
  }

  @Post("series/:id/cover")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(imageUpload())
  setCover(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() req: Request
  ) {
    return this.admin.setSeriesImage(actor.sub, id, "cover", file, req.context);
  }

  @Post("series/:id/banner")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(imageUpload())
  setBanner(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() req: Request
  ) {
    return this.admin.setSeriesImage(actor.sub, id, "banner", file, req.context);
  }

  // ---- tags ----

  @Post("tags")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  createTag(@Body() dto: CreateTagDto, @CurrentUser() actor: AccessTokenPayload, @Req() req: Request) {
    return this.admin.createTag(actor.sub, dto, req.context);
  }

  // ---- teams ----

  @Post("teams")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  createTeam(@Body() dto: CreateTeamDto, @CurrentUser() actor: AccessTokenPayload, @Req() req: Request) {
    return this.admin.createTeam(actor.sub, dto, req.context);
  }

  @Patch("teams/:id")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  updateTeam(@Param("id") id: string, @Body() dto: UpdateTeamDto, @CurrentUser() actor: AccessTokenPayload, @Req() req: Request) {
    return this.admin.updateTeam(actor.sub, id, dto, req.context);
  }

  @Delete("teams/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  deleteTeam(@Param("id") id: string, @CurrentUser() actor: AccessTokenPayload, @Req() req: Request) {
    return this.admin.deleteTeam(actor.sub, id, req.context);
  }

  @Post("teams/:id/logo")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(imageUpload())
  setLogo(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() req: Request
  ) {
    return this.admin.setTeamLogo(actor.sub, id, file, req.context);
  }

  @Put("teams/:id/members/:userId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  setMember(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @Body() dto: SetMemberDto,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() req: Request
  ) {
    return this.admin.setMember(actor.sub, id, userId, dto.role, req.context);
  }

  @Delete("teams/:id/members/:userId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  removeMember(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() req: Request
  ) {
    return this.admin.removeMember(actor.sub, id, userId, req.context);
  }

  // ---- news ----

  @Post("news")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  createNews(@Body() dto: CreateNewsDto, @CurrentUser() actor: AccessTokenPayload, @Req() req: Request) {
    return this.admin.createNews(actor.sub, dto, req.context);
  }

  @Patch("news/:id")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  updateNews(@Param("id") id: string, @Body() dto: UpdateNewsDto, @CurrentUser() actor: AccessTokenPayload, @Req() req: Request) {
    return this.admin.updateNews(actor.sub, id, dto, req.context);
  }

  @Delete("news/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  deleteNews(@Param("id") id: string, @CurrentUser() actor: AccessTokenPayload, @Req() req: Request) {
    return this.admin.deleteNews(actor.sub, id, req.context);
  }

  @Post("news/:id/cover")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(imageUpload())
  setNewsCover(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() req: Request
  ) {
    return this.admin.setNewsCover(actor.sub, id, file, req.context);
  }
}
