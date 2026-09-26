import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { ListNotificationsQueryDto, MarkAllReadDto } from "./dto/notifications.dto";
import { NotificationsService } from "./notifications.service";

/** Every route here is implicitly scoped to the caller's own notifications via actor.sub — there is no way to list or mark another user's. */
@Controller("v1/notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Query() query: ListNotificationsQueryDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.notifications.list(actor.sub, query);
  }

  /** Just the number, for the bell's badge. */
  @Get("unread-count")
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  unreadCount(@CurrentUser() actor: AccessTokenPayload) {
    return this.notifications.unreadCount(actor.sub);
  }

  @Patch("read-all")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  markAllRead(@Body() body: MarkAllReadDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.notifications.markAllRead(actor.sub, body.category);
  }

  @Patch(":id/read")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  markRead(@Param("id") id: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.notifications.markRead(actor.sub, id);
  }
}
