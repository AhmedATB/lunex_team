import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { PreferencesDto, SubscribeDto, UnsubscribeDto } from "./dto/push.dto";
import { PushService } from "./push.service";

/** Notifications to the member's devices. Every route needs a signed-in account and only ever concerns that account's own devices. */
@Controller("v1/push")
export class PushController {
  constructor(private readonly push: PushService) {}

  /** The site's public key: a browser needs it to subscribe. */
  @Get("public-key")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  publicKey() {
    return this.push.publicKey();
  }

  /** Whether this device (`endpoint`, from the browser) is set up, how many of the account's devices are, and what the account wants. */
  @Get("status")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  status(@Query("endpoint") endpoint: string | undefined, @CurrentUser() actor: AccessTokenPayload) {
    return this.push.status(actor.sub, endpoint);
  }

  @Post("subscribe")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  subscribe(@Body() dto: SubscribeDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.push.subscribe(actor.sub, dto, undefined);
  }

  @Post("unsubscribe")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  unsubscribe(@Body() dto: UnsubscribeDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.push.unsubscribe(actor.sub, dto.endpoint);
  }

  @Get("preferences")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  preferences(@CurrentUser() actor: AccessTokenPayload) {
    return this.push.status(actor.sub, undefined).then((s) => s.preferences);
  }

  @Put("preferences")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  setPreferences(@Body() dto: PreferencesDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.push.setPreferences(actor.sub, dto);
  }

  /** Sends a test notification to the account's own devices. */
  @Post("test")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  test(@CurrentUser() actor: AccessTokenPayload) {
    return this.push.sendTest(actor.sub);
  }
}
