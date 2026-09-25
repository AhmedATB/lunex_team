import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { CommentsController } from "./comments.controller";
import { CommentsRepository } from "./comments.repository";
import { CommentsService } from "./comments.service";

@Module({
  imports: [NotificationsModule],
  controllers: [CommentsController],
  providers: [CommentsService, CommentsRepository],
})
export class CommentsModule {}
