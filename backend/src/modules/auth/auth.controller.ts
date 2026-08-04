import { Body, Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { RequirePow } from "../../common/decorators/require-pow.decorator";
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
    return this.auth.register(dto.email, dto.password, req.context);
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
}
