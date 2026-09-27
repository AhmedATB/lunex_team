import { Module } from "@nestjs/common";
import { AnnouncementsRepository } from "./announcements.repository";
import { AnnouncementsService } from "./announcements.service";

@Module({
  providers: [AnnouncementsService, AnnouncementsRepository],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
