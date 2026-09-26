import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { REQUIRE_TURNSTILE_KEY } from "../decorators/require-turnstile.decorator";
import { TurnstileService } from "./turnstile.service";

/** The header the frontend's proxy forwards the widget's token in. */
export const TURNSTILE_HEADER = "x-turnstile-token";

@Injectable()
export class TurnstileGuard implements CanActivate {
  constructor(
    private readonly turnstile: TurnstileService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const action = this.reflector.getAllAndOverride<string | undefined>(REQUIRE_TURNSTILE_KEY, [context.getHandler(), context.getClass()]);
    if (!action || !this.turnstile.enabled) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = request.header(TURNSTILE_HEADER);
    if (!token) {
      throw new HttpException({ code: "turnstile_required", message: "Please confirm you are not a robot." }, HttpStatus.FORBIDDEN);
    }
    const result = await this.turnstile.verify(token, request.context?.ip ?? request.ip, action);
    if (!result.ok) {
      throw new HttpException({ code: "turnstile_failed", message: "The check did not pass; please try again." }, HttpStatus.FORBIDDEN);
    }
    return true;
  }
}
