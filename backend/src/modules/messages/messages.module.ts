import { Module } from "@nestjs/common";
import { AttachmentsModule } from "../attachments/attachments.module";
import { PushModule } from "../push/push.module";
import { MessagesController } from "./messages.controller";
import { MessagesRepository } from "./messages.repository";
import { MessagesService } from "./messages.service";

@Module({
  imports: [AttachmentsModule, PushModule],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesRepository],
})
export class MessagesModule {}
