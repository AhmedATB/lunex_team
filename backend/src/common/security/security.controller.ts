import { Controller, Get, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { Public } from "../decorators/public.decorator";
import { ProofOfWorkService } from "./proof-of-work.service";

@Controller("v1/security")
export class SecurityController {
  constructor(private readonly pow: ProofOfWorkService) {}

  @Public()
  @Get("challenge")
  // Generous limit deliberately: the PoW solve cost itself is the throttle
  // on abuse, not challenge issuance — a legitimate reader working through
  // many pages needs a fresh challenge per page (each solved token is
  // single-use), so gating issuance tightly would throttle real usage
  // instead of bots.
  @Throttle({ default: { limit: 200, ttl: 60_000 } })
  issueChallenge() {
    return this.pow.issue();
  }

  /**
   * Which address does the backend take the caller to have, and was it vouched for by our frontend (the shared key)?
   * A caller only ever learns about itself — this is how a deploy is checked: through the frontend it should show the
   * visitor's own address with `verified: true`; `false` means the two services' BFF_SHARED_KEY do not match (or one lacks it).
   */
  @Public()
  @Get("client")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  client(@Req() req: Request) {
    return { ip: req.context.ip, verified: req.context.ipVerified };
  }
}
