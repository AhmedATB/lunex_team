import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { RequirePow } from "../../common/decorators/require-pow.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { RegisterDto } from "./dto/register.dto";

/**
 * HTTP boundary only (architecture doc §3) — every handler here is a
 * one-line delegation to AuthService. If you find yourself writing an if
 * statement in this file, it belongs in the service instead.
 */
@Controller("v1/auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @RequirePow() // CPU-cost gate on top of the rate limit — see ProofOfWorkService for why
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // 5 registrations/min/IP — slows bulk fake-account creation
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto.email, dto.password, dto.username, req.context);
  }

  @Public()
  @RequirePow()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // 10 attempts/min/IP — credential-stuffing friction; per-account limiting is a Redis-backed follow-up (§14)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto.email, dto.password, req.context);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, req.context);
  }

  /** No @Public() — the global JwtAuthGuard requires a valid access token, which is exactly what "who am I" should mean. */
  @Get("me")
  @HttpCode(HttpStatus.OK)
  me(@CurrentUser() user: AccessTokenPayload) {
    return this.auth.me(user.sub);
  }

  /** @Public() like refresh — the refresh token itself is the credential; a caller can log out even with an expired/missing access token. */
  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async logout(@Body() dto: RefreshDto, @Req() req: Request) {
    await this.auth.logout(dto.refreshToken, req.context);
  }
}
