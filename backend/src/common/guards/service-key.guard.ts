import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";

/**
 * Gate for machine-to-machine routes (the bot integration) that have no
 * human actor and so can't go through JwtAuthGuard at all — these routes
 * are marked @Public() to skip it and rely on this guard instead. Not a
 * user credential: BOT_INTEGRATION_SECRET is a generated infrastructure
 * secret, the same category as JWT_REFRESH_PEPPER.
 */
@Injectable()
export class ServiceKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.header("x-service-key");
    const expected = this.config.getOrThrow<string>("BOT_INTEGRATION_SECRET");

    if (!provided) {
      throw new UnauthorizedException({ code: "missing_service_key", message: "Service key required." });
    }

    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    // Length check before timingSafeEqual — mirrors image-token.util.ts's
    // verify(): it throws on mismatched buffer lengths rather than
    // returning false, and the length itself isn't a secret.
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException({ code: "invalid_service_key", message: "Invalid service key." });
    }

    return true;
  }
}
