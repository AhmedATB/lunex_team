import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { CreateCollaborationDto, RespondCollaborationDto } from "./dto/collaboration.dto";
import { CollaborationService } from "./collaboration.service";

/** Teams asking each other for help. Every route needs an account; the service decides against the account's role in the teams. */
@Controller("v1/collaboration")
export class CollaborationController {
  constructor(private readonly collaboration: CollaborationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  create(@Body() dto: CreateCollaborationDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.collaboration.create(actor.sub, dto);
  }

  @Get("teams/:teamId")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  list(@Param("teamId") teamId: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.collaboration.list(actor.sub, teamId);
  }

  @Patch(":id")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  respond(@Param("id") id: string, @Body() dto: RespondCollaborationDto, @CurrentUser() actor: AccessTokenPayload, @Req() req: Request) {
    return this.collaboration.respond(actor.sub, id, dto, req.context);
  }

  @Delete("series/:seriesId/teams/:teamId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  removeCollaborator(@Param("seriesId") seriesId: string, @Param("teamId") teamId: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.collaboration.removeCollaborator(actor.sub, seriesId, teamId);
  }
}
