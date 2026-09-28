import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { memoryStorage } from "multer";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { AddMembersDto, CreateConversationDto, ListMessagesQueryDto, SendMessageDto, SetMemberRoleDto, UpdateConversationDto } from "./dto/messages.dto";
import { MessagesService } from "./messages.service";

const MAX_GROUP_PHOTO_BYTES = 5 * 1024 * 1024;

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

  /** The people the caller has blocked. Declared before the `:id` routes so `blocks` is never read as an id. */
  @Get("blocks")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  blocked(@CurrentUser() actor: AccessTokenPayload) {
    return this.messages.blocked(actor.sub);
  }

  @Put("blocks/:userId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  block(@Param("userId") userId: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.messages.block(actor.sub, userId);
  }

  @Delete("blocks/:userId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  unblock(@Param("userId") userId: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.messages.unblock(actor.sub, userId);
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

  @Patch(":id/messages/:messageId")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  editMessage(@Param("id") id: string, @Param("messageId") messageId: string, @Body() dto: SendMessageDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.messages.editMessage(actor.sub, id, messageId, dto);
  }

  @Delete(":id/messages/:messageId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  deleteMessage(@Param("id") id: string, @Param("messageId") messageId: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.messages.deleteMessage(actor.sub, id, messageId);
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

  /** Declared before `members/:userId` so `me` is never read as an id. */
  @Delete(":id/members/me")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  leave(@Param("id") id: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.messages.leave(actor.sub, id);
  }

  // ---- managing a group (its owner and admins) ----

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  updateGroup(@Param("id") id: string, @Body() dto: UpdateConversationDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.messages.updateGroup(actor.sub, id, dto);
  }

  /** memoryStorage — the picture must reach the service as a Buffer (to be cropped and re-encoded), never touch the ephemeral disk. */
  @Put(":id/photo")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: MAX_GROUP_PHOTO_BYTES } }))
  setGroupPhoto(@Param("id") id: string, @UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() actor: AccessTokenPayload) {
    return this.messages.setGroupPhoto(actor.sub, id, file);
  }

  @Delete(":id/photo")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  removeGroupPhoto(@Param("id") id: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.messages.removeGroupPhoto(actor.sub, id);
  }

  /** The group's picture, for its members. */
  @Get(":id/photo")
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async groupPhoto(@Param("id") id: string, @CurrentUser() actor: AccessTokenPayload, @Res() res: Response) {
    const photo = await this.messages.groupPhoto(actor.sub, id);
    res.setHeader("Content-Type", photo.mimeType);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(photo.data);
  }

  @Delete(":id/members/:userId")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  removeMember(@Param("id") id: string, @Param("userId") userId: string, @CurrentUser() actor: AccessTokenPayload) {
    return this.messages.removeMember(actor.sub, id, userId);
  }

  @Patch(":id/members/:userId")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  setMemberRole(@Param("id") id: string, @Param("userId") userId: string, @Body() dto: SetMemberRoleDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.messages.setMemberRole(actor.sub, id, userId, dto);
  }
}
