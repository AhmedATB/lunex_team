import { Controller, Get, Param } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { TeamActivityService } from "./team-activity.service";

/** A team's activity log, for its leaders and the site's team managers. */
@Controller("v1/team-activity")
export class TeamActivityController {
  constructor(private readonly activity: TeamActivityService) {}

  @Get(":teamId")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  list(@Param("teamId") teamId: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.activity.list(actor.sub, teamId);
  }
}
