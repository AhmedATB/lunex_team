import { Module } from "@nestjs/common";
import { ChaptersModule } from "../chapters/chapters.module";
import { BotIntegrationController } from "./bot-integration.controller";

@Module({
  imports: [ChaptersModule],
  controllers: [BotIntegrationController],
})
export class BotIntegrationModule {}
