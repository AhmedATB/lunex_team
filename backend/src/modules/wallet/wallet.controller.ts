import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { GrantCoinsDto } from "./dto/grant-coins.dto";
import { UpdateWalletSettingsDto } from "./dto/wallet-settings.dto";
import { WalletSettingsService } from "./wallet-settings.service";
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

/**
 * Which chapters are locked, for everyone including visitors: the browser draws lock icons from this, and the server is the one
 * that refuses a locked chapter. Only the two numbers that decide it; nothing about prices or members.
 */
@Public()
@Controller("v1/wallet")
export class PublicWalletController {
  constructor(private readonly settings: WalletSettingsService) {}

  @Get("rule")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async rule() {
    const { lockedWindow, freeFirstChapters } = await this.settings.current();
    return { lockedWindow, freeFirstChapters };
  }
}

/** The owner's side of the wallet: adding coins to a member, the ledger and the lock settings. The services re-check the role from the database. */
@Controller("v1/admin/wallet")
export class AdminWalletController {
  constructor(
    private readonly wallet: WalletService,
    private readonly settings: WalletSettingsService
  ) {}

  @Get("settings")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  getSettings(@CurrentUser() user: AccessTokenPayload) {
    return this.settings.view(user.sub);
  }

  /** Owner and super administrator only. Any of the settings; the ones left out stay as they are. */
  @Put("settings")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  updateSettings(@Body() dto: UpdateWalletSettingsDto, @CurrentUser() user: AccessTokenPayload) {
    return this.settings.update(user.sub, dto);
  }

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
