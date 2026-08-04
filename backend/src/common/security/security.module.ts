import { Global, Module } from "@nestjs/common";
import { BotUserAgentGuard } from "./bot-user-agent.guard";
import { ProofOfWorkGuard } from "./proof-of-work.guard";
import { ProofOfWorkService } from "./proof-of-work.service";
import { SecurityController } from "./security.controller";

@Global()
@Module({
  controllers: [SecurityController],
  providers: [ProofOfWorkService, ProofOfWorkGuard, BotUserAgentGuard],
  exports: [ProofOfWorkService, ProofOfWorkGuard, BotUserAgentGuard],
})
export class SecurityModule {}
