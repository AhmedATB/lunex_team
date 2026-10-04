import { Module } from "@nestjs/common";
import { AnnouncementsModule } from "../announcements/announcements.module";
import { CatalogModule } from "../catalog/catalog.module";
import { ImagesModule } from "../images/images.module";
import { WalletModule } from "../wallet/wallet.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TeamAccessModule } from "../team-access/team-access.module";
import { TeamActivityModule } from "../team-activity/team-activity.module";
import { ChapterImportService } from "./chapter-import.service";
import { ChapterThumbnailService } from "./chapter-thumbnail.service";
import { ChaptersController } from "./chapters.controller";
import { ChaptersRepository } from "./chapters.repository";
import { ChaptersService } from "./chapters.service";

@Module({
  imports: [AnnouncementsModule, CatalogModule, ImagesModule, WalletModule, NotificationsModule, TeamActivityModule, TeamAccessModule],
  controllers: [ChaptersController],
  providers: [ChaptersService, ChaptersRepository, ChapterImportService, ChapterThumbnailService],
  exports: [ChaptersService],
})
export class ChaptersModule {}
