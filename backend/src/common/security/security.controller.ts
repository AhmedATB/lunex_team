import { Controller, Get } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
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
}
