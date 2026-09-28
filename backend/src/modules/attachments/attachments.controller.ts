import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { memoryStorage } from "multer";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { AttachmentsService } from "./attachments.service";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

@Controller("v1/attachments")
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  /** memoryStorage — the picture must reach the service as a Buffer (to be checked and re-encoded), never touch Railway's ephemeral disk. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() actor: AccessTokenPayload) {
    return this.attachments.upload(actor.sub, file);
  }

  /**
   * Public only so that a comment's picture can be shown to a visitor: the service decides, from where the picture ended up and who
   * is asking (the guard attaches the caller when a valid token is sent), whether this viewer may have it.
   */
  @Public()
  @Get(":id")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  async view(@Param("id") id: string, @Query("size") size: string | undefined, @CurrentUser() viewer: AccessTokenPayload | undefined, @Res() res: Response) {
    const image = await this.attachments.view(viewer?.sub, id, size === "thumb" ? "thumb" : "full");
    res.setHeader("Content-Type", image.mimeType);
    res.setHeader("Cache-Control", image.publicCache ? "public, max-age=86400" : "private, max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(image.data);
  }
}
