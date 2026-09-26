import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { GrantCoinsDto } from "./dto/grant-coins.dto";
import { WalletService } from "./wallet.service";

/** A member's own coins, reading credits and opened chapters. Signed-in only; it only ever describes the caller. */
@Controller("v1/me")
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get("wallet")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  get(@CurrentUser() user: AccessTokenPayload) {
    return this.wallet.snapshot(user.sub);
  }
}

/** The owner's side of the wallet: adding coins to a member and seeing the ledger. The service re-checks the role from the database. */
@Controller("v1/admin/wallet")
export class AdminWalletController {
  constructor(private readonly wallet: WalletService) {}

  @Post("grant")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  grant(@Body() dto: GrantCoinsDto, @CurrentUser() user: AccessTokenPayload) {
    return this.wallet.grantCoins(user.sub, dto.username, dto.amount, dto.note);
  }

  @Get("transactions")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  transactions(@CurrentUser() user: AccessTokenPayload, @Query("limit") limit?: string) {
    return this.wallet.recentTransactions(user.sub, Number(limit) || 50);
  }
}
