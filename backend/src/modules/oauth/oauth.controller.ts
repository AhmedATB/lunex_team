import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Post, Req } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { OAuthCallbackDto } from "./dto/oauth-callback.dto";
import { OAuthService, type OAuthProviderId } from "./oauth.service";

const VALID_PROVIDERS: OAuthProviderId[] = ["discord", "google"];

/**
 * Only ever called by our own Next.js server (never the browser directly —
 * the browser is redirected TO the provider by Next.js after this returns a
 * URL, and lands back on a Next.js callback route, which is what calls
 * /callback here). Both routes are @Public(): a JWT can't exist yet at
 * this point in the flow, that's the whole thing this endpoint produces.
 */
@Controller("v1/auth/oauth")
export class OAuthController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly config: ConfigService
  ) {}

  @Public()
  @Get(":provider/start")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  start(@Param("provider") provider: string) {
    const validated = this.assertProvider(provider);
    return this.oauth.startAuthorize(validated, this.redirectUriFor(validated));
  }

  @Public()
  @Post(":provider/callback")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  callback(@Param("provider") provider: string, @Body() dto: OAuthCallbackDto, @Req() req: Request) {
    const validated = this.assertProvider(provider);
    return this.oauth.handleCallback(validated, dto.code, this.redirectUriFor(validated), req.context);
  }

  /** Derived from a configured, trusted base URL rather than accepted as a caller-supplied parameter — the redirect_uri is exactly what's registered with each provider, so it must never be attacker-influenceable. */
  private redirectUriFor(provider: OAuthProviderId): string {
    const base = this.config.get<string>("FRONTEND_URL") ?? "http://localhost:3000";
    return `${base}/api/auth/callback/${provider}`;
  }

  private assertProvider(provider: string): OAuthProviderId {
    if (!VALID_PROVIDERS.includes(provider as OAuthProviderId)) {
      throw new NotFoundException({ code: "unknown_provider", message: "Unsupported OAuth provider." });
    }
    return provider as OAuthProviderId;
  }
}
