import { Controller, Get, HttpCode, HttpStatus, Param, Patch } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { NotificationsService } from "./notifications.service";

/** Every route here is implicitly scoped to the caller's own notifications via actor.sub — there is no way to list or mark another user's. */
@Controller("v1/notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() actor: AccessTokenPayload) {
    return this.notifications.list(actor.sub);
  }

  @Patch(":id/read")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  markRead(@Param("id") id: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.notifications.markRead(actor.sub, id);
  }

  @Patch("read-all")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  markAllRead(@CurrentUser() actor: AccessTokenPayload) {
    return this.notifications.markAllRead(actor.sub);
  }
}
