import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { memoryStorage } from "multer";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { ListTeamRequestsDto, ReviewTeamRequestDto, TeamRequestDto } from "./dto/team-request.dto";
import { TeamRequestsService } from "./team-requests.service";

const MAX_LOGO_BYTES = 8 * 1024 * 1024;
const logoUpload = () => FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: MAX_LOGO_BYTES } });

/**
 * Requests to open a team. Every route needs an account; a member sees and resends their own, the site's team managers see
 * and decide on all of them (the service checks the account's current role).
 */
@Controller("v1/team-requests")
export class TeamRequestsController {
  constructor(private readonly requests: TeamRequestsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  create(@Body() dto: TeamRequestDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.requests.create(actor.sub, dto);
  }

  /** Declared before the `:id` routes so it is never read as an id. */
  @Get("me")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  mine(@CurrentUser() actor: AccessTokenPayload) {
    return this.requests.mine(actor.sub);
  }

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  list(@Query() query: ListTeamRequestsDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.requests.list(actor.sub, query.status);
  }

  @Put(":id")
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  resubmit(@Param("id") id: string, @Body() dto: TeamRequestDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.requests.resubmit(actor.sub, id, dto);
  }

  /** The logo, chosen from the requester's device. Only the requester, and only while the request can still change. */
  @Post(":id/logo")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(logoUpload())
  setLogo(@Param("id") id: string, @UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() actor: AccessTokenPayload) {
    return this.requests.setLogo(actor.sub, id, file);
  }

  @Delete(":id/logo")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  removeLogo(@Param("id") id: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.requests.removeLogo(actor.sub, id);
  }

  /** The requester and the site's team managers can see it; nobody else. The address carries a version stamp, so it can be cached. */
  @Get(":id/logo")
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async logo(@Param("id") id: string, @CurrentUser() actor: AccessTokenPayload, @Res() res: Response) {
    const image = await this.requests.logoImage(actor.sub, id);
    res.setHeader("Content-Type", image.mimeType);
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.send(image.data);
  }

  @Patch(":id/review")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  review(@Param("id") id: string, @Body() dto: ReviewTeamRequestDto, @CurrentUser() actor: AccessTokenPayload, @Req() req: Request) {
    return this.requests.review(actor.sub, id, dto, req.context);
  }
}
