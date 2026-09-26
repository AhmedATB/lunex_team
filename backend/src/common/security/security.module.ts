import { Global, Module } from "@nestjs/common";
import { BotUserAgentGuard } from "./bot-user-agent.guard";
import { ProofOfWorkGuard } from "./proof-of-work.guard";
import { ProofOfWorkService } from "./proof-of-work.service";
import { SecurityController } from "./security.controller";
import { TurnstileGuard } from "./turnstile.guard";
import { TurnstileService } from "./turnstile.service";

@Global()
@Module({
  controllers: [SecurityController],
  providers: [ProofOfWorkService, ProofOfWorkGuard, BotUserAgentGuard, TurnstileService, TurnstileGuard],
  exports: [ProofOfWorkService, ProofOfWorkGuard, BotUserAgentGuard, TurnstileService, TurnstileGuard],
})
export class SecurityModule {}
