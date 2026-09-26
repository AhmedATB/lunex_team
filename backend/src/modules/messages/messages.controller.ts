import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { AddMembersDto, CreateConversationDto, ListMessagesQueryDto, SendMessageDto } from "./dto/messages.dto";
import { MessagesService } from "./messages.service";

/** Every route needs a signed-in account and is scoped to the conversations that account belongs to. */
@Controller("v1/conversations")
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  list(@CurrentUser() actor: AccessTokenPayload) {
    return this.messages.list(actor.sub);
  }

  /** Declared before the `:id` routes so it is never read as an id. */
  @Get("unread-count")
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  unreadCount(@CurrentUser() actor: AccessTokenPayload) {
    return this.messages.unreadCount(actor.sub);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  create(@Body() dto: CreateConversationDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.messages.create(actor.sub, dto);
  }

  @Get(":id/messages")
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  listMessages(@Param("id") id: string, @Query() query: ListMessagesQueryDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.messages.messages(actor.sub, id, query);
  }

  @Post(":id/messages")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  send(@Param("id") id: string, @Body() dto: SendMessageDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.messages.send(actor.sub, id, dto);
  }

  @Post(":id/read")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  markRead(@Param("id") id: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.messages.markRead(actor.sub, id);
  }

  @Post(":id/members")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  addMembers(@Param("id") id: string, @Body() dto: AddMembersDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.messages.addMembers(actor.sub, id, dto);
  }

  @Delete(":id/members/me")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  leave(@Param("id") id: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.messages.leave(actor.sub, id);
  }
}
