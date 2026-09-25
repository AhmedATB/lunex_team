import { Module } from "@nestjs/common";
import { ModerationModule } from "../moderation/moderation.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { UsersController } from "./users.controller";
import { UsersRepository } from "./users.repository";
import { UsersService } from "./users.service";

@Module({
  imports: [NotificationsModule, ModerationModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
})
export class UsersModule {}
