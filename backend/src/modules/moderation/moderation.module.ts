import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { ModerationController } from "./moderation.controller";
import { ModerationRepository } from "./moderation.repository";
import { ModerationService } from "./moderation.service";

@Module({
  imports: [NotificationsModule],
  controllers: [ModerationController],
  providers: [ModerationService, ModerationRepository],
  exports: [ModerationService],
})
export class ModerationModule {}
