import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { ListTeamRequestsDto, ReviewTeamRequestDto, TeamRequestDto } from "./dto/team-request.dto";
import { TeamRequestsService } from "./team-requests.service";

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

  @Patch(":id/review")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  review(@Param("id") id: string, @Body() dto: ReviewTeamRequestDto, @CurrentUser() actor: AccessTokenPayload, @Req() req: Request) {
    return this.requests.review(actor.sub, id, dto, req.context);
  }
}
