import { Module } from "@nestjs/common";
import { ImagesModule } from "../images/images.module";
import { WalletModule } from "../wallet/wallet.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ChapterImportService } from "./chapter-import.service";
import { ChaptersController } from "./chapters.controller";
import { ChaptersRepository } from "./chapters.repository";
import { ChaptersService } from "./chapters.service";

@Module({
  imports: [ImagesModule, WalletModule, NotificationsModule],
  controllers: [ChaptersController],
  providers: [ChaptersService, ChaptersRepository, ChapterImportService],
  exports: [ChaptersService],
})
export class ChaptersModule {}
