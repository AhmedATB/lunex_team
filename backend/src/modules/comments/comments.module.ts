import { Module } from "@nestjs/common";
import { AttachmentsModule } from "../attachments/attachments.module";
import { ProgressModule } from "../progress/progress.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { CommentsController } from "./comments.controller";
import { CommentsRepository } from "./comments.repository";
import { CommentsService } from "./comments.service";

@Module({
  imports: [AttachmentsModule, NotificationsModule, ProgressModule],
  controllers: [CommentsController],
  providers: [CommentsService, CommentsRepository],
})
export class CommentsModule {}
