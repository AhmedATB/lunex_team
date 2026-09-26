import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { ApplyDto, CreatePositionDto, PositionsQueryDto, ReviewApplicationDto, SetPositionOpenDto } from "./dto/recruitment.dto";
import { RecruitmentService } from "./recruitment.service";

/**
 * Recruitment. A team's open positions are public (the team page lists them); everything else needs an account, and the
 * service decides against the account's current role and the team's roster who may open positions or review applications.
 */
@Controller("v1/recruitment")
export class RecruitmentController {
  constructor(private readonly recruitment: RecruitmentService) {}

  @Public()
  @Get("teams/:teamId/positions")
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  positions(@Param("teamId") teamId: string, @Query() query: PositionsQueryDto, @CurrentUser() actor: AccessTokenPayload | undefined) {
    return this.recruitment.listPositions(teamId, actor?.sub, query.all === "true");
  }

  @Post("teams/:teamId/positions")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  createPosition(@Param("teamId") teamId: string, @Body() dto: CreatePositionDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.recruitment.createPosition(actor.sub, teamId, dto);
  }

  @Patch("positions/:id")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  setOpen(@Param("id") id: string, @Body() dto: SetPositionOpenDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.recruitment.setPositionOpen(actor.sub, id, dto.isOpen);
  }

  @Delete("positions/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  deletePosition(@Param("id") id: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.recruitment.deletePosition(actor.sub, id);
  }

  @Post("teams/:teamId/applications")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  apply(@Param("teamId") teamId: string, @Body() dto: ApplyDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.recruitment.apply(actor.sub, teamId, dto);
  }

  @Get("teams/:teamId/applications")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  teamApplications(@Param("teamId") teamId: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.recruitment.teamApplications(actor.sub, teamId);
  }

  /** Declared before the `:id` routes so it is never read as an id. */
  @Get("me/applications")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  mine(@CurrentUser() actor: AccessTokenPayload) {
    return this.recruitment.myApplications(actor.sub);
  }

  @Patch("applications/:id")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  review(@Param("id") id: string, @Body() dto: ReviewApplicationDto, @CurrentUser() actor: AccessTokenPayload, @Req() req: Request) {
    return this.recruitment.review(actor.sub, id, dto, req.context);
  }

  @Delete("applications/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  withdraw(@Param("id") id: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.recruitment.withdraw(actor.sub, id);
  }
}
