import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

export interface AccessTokenPayload {
  sub: string; // user id
  role: string;
}

/**
 * Global guard (wired in AppModule via APP_GUARD) — auth is opt-out via
 * @Public(), not opt-in per-route. A new endpoint that forgets to add a
 * guard is secure by default instead of silently open.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException({ code: "missing_token", message: "Authentication required." });

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException({ code: "invalid_token", message: "Session expired or invalid." });
    }
  }

  private extractToken(request: Request): string | undefined {
    const header = request.header("authorization");
    if (!header?.startsWith("Bearer ")) return undefined;
    return header.slice("Bearer ".length).trim() || undefined;
  }
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AccessTokenPayload;
  }
}
