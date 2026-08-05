import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { ChangeRoleDto } from "./dto/change-role.dto";
import { UsersService } from "./users.service";

/** No @Public() anywhere here — every route requires a valid access token via the global JwtAuthGuard, and UsersService independently re-checks the actor's actual DB role before allowing anything. */
@Controller("v1/users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch(":id/role")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  changeRole(
    @Param("id") id: string,
    @Body() dto: ChangeRoleDto,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() req: Request
  ) {
    return this.users.changeRole(actor.sub, id, dto.role, req.context);
  }
}
