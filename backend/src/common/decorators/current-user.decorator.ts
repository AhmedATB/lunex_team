import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AccessTokenPayload } from "../guards/jwt-auth.guard";

/** Reads the user attached by JwtAuthGuard — never re-decodes the token or trusts a client-sent user id. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AccessTokenPayload => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
