import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { ImagesService } from "./images.service";

@Controller("v1/images")
export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  /** Requires a full access token (global JwtAuthGuard applies — no @Public() here) — issuing a page token is a privileged action, unlike redeeming one. */
  @Post(":assetId/token")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  issueToken(@Param("assetId") assetId: string, @CurrentUser() user: AccessTokenPayload, @Req() req: Request) {
    return this.images.issueToken(assetId, user.sub, req.context);
  }

  /**
   * Public route (opts out of the global guard) because the reader client
   * calls this via an authenticated `fetch()` — never a plain `<img src>` —
   * and decrypts/renders the response onto a `<canvas>` (architecture doc
   * §11). The route itself is only "public" in the routing sense; every
   * request is still authenticated by the signed, device-bound, single-use
   * token in the query string, verified inside ImagesService.
   */
  @Public()
  @Get(":assetId/stream")
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async stream(
    @Param("assetId") assetId: string,
    @Query("token") token: string | undefined,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const { buffer, contentType } = await this.images.streamAsset(assetId, token, req.context);
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Type", contentType);
    res.send(buffer);
  }
}
