import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { CreateCommentDto, ReactDto, ReportCommentDto, SERIES_ID_PATTERN, StaffCommentsQueryDto, UpdateCommentDto } from "./dto/comment.dto";
import { CommentsService } from "./comments.service";

/**
 * Reading is public (the guard still attaches the caller when a valid token is
 * sent, so each comment can carry the viewer's own reaction); everything that
 * writes needs a signed-in account. Static paths (`latest`, `reports/queue`)
 * are declared before the `:id` routes so they are never read as an id.
 */
@Controller("v1/comments")
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  list(@Query("seriesId") seriesId: string | undefined, @CurrentUser() viewer: AccessTokenPayload | undefined) {
    if (!seriesId || !SERIES_ID_PATTERN.test(seriesId)) {
      throw new BadRequestException({ code: "invalid_series_id", message: "A valid seriesId is required." });
    }
    return this.comments.listForSeries(seriesId, viewer?.sub);
  }

  @Public()
  @Get("latest")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  latest(@Query("limit") limit: string | undefined) {
    const n = Number.parseInt(limit ?? "", 10);
    return this.comments.latest(Number.isFinite(n) ? n : 10);
  }

  /** Every comment, for moderators. Declared with the other static paths, before anything shaped like `:id`. */
  @Get("admin")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  listForStaff(@Query() query: StaffCommentsQueryDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.comments.listForStaff(actor.sub, query);
  }

  @Get("reports/queue")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  queue(@CurrentUser() actor: AccessTokenPayload) {
    return this.comments.reportQueue(actor.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  create(@Body() dto: CreateCommentDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.comments.create(actor.sub, dto);
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  update(@Param("id") id: string, @Body() dto: UpdateCommentDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.comments.update(actor.sub, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  remove(@Param("id") id: string, @CurrentUser() actor: AccessTokenPayload, @Req() req: Request) {
    return this.comments.remove(actor.sub, id, req.context);
  }

  @Put(":id/reaction")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  react(@Param("id") id: string, @Body() dto: ReactDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.comments.react(actor.sub, id, dto.kind);
  }

  @Post(":id/report")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  report(@Param("id") id: string, @Body() dto: ReportCommentDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.comments.report(actor.sub, id, dto.reason);
  }

  @Delete(":id/reports")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  dismiss(@Param("id") id: string, @CurrentUser() actor: AccessTokenPayload, @Req() req: Request) {
    return this.comments.dismissReports(actor.sub, id, req.context);
  }
}
