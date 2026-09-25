import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { CreateSanctionDto } from "./dto/create-sanction.dto";
import { RemoveCommentsDto, ResetProfileDto } from "./dto/staff-actions.dto";
import { ModerationService } from "./moderation.service";

/** Authenticated like everything by default; ModerationService re-checks the actor's CURRENT role in the database, so a demoted moderator loses access at once rather than when their token expires. */
@Controller("v1/moderation")
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get("users/:id/sanctions")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  list(@Param("id") id: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.moderation.listForUser(actor.sub, id);
  }

  @Post("users/:id/sanctions")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  create(
    @Param("id") id: string,
    @Body() dto: CreateSanctionDto,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() req: Request
  ) {
    return this.moderation.applySanction(actor.sub, id, dto, req.context);
  }

  @Post("users/:id/reset-profile")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  resetProfile(
    @Param("id") id: string,
    @Body() dto: ResetProfileDto,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() req: Request
  ) {
    return this.moderation.resetProfile(actor.sub, id, dto, req.context);
  }

  @Post("users/:id/remove-comments")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  removeComments(
    @Param("id") id: string,
    @Body() dto: RemoveCommentsDto,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() req: Request
  ) {
    return this.moderation.removeAllComments(actor.sub, id, dto, req.context);
  }

  @Post("users/:id/sign-out")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  signOut(@Param("id") id: string, @CurrentUser() actor: AccessTokenPayload, @Req() req: Request) {
    return this.moderation.signOutEverywhere(actor.sub, id, req.context);
  }

  @Delete("users/:id/sanctions/:sanctionId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  revoke(
    @Param("id") id: string,
    @Param("sanctionId") sanctionId: string,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() req: Request
  ) {
    return this.moderation.revokeSanction(actor.sub, id, sanctionId, req.context);
  }
}
