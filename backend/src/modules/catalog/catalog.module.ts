import { Module } from "@nestjs/common";
import { ProgressModule } from "../progress/progress.module";
import { ImagesModule } from "../images/images.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { CatalogAdminController } from "./catalog-admin.controller";
import { CatalogAdminService } from "./catalog-admin.service";
import { CatalogController } from "./catalog.controller";
import { CatalogRepository } from "./catalog.repository";
import { CatalogService } from "./catalog.service";
import { EngagementController } from "./engagement.controller";
import { EngagementRepository } from "./engagement.repository";
import { EngagementService } from "./engagement.service";
import { LegacyChapterImportService } from "./legacy/legacy-chapter-import.service";
import { LegacyImportController } from "./legacy/legacy-import.controller";
import { LegacyImportService } from "./legacy/legacy-import.service";
import { StorageAdminService } from "./legacy/storage-admin.service";

/** ImagesModule exports StorageService, so covers and logos live behind the same swappable backend as chapter pages. */
@Module({
  imports: [ImagesModule, ProgressModule, NotificationsModule],
  controllers: [CatalogController, CatalogAdminController, EngagementController, LegacyImportController],
  providers: [CatalogService, CatalogAdminService, CatalogRepository, EngagementService, EngagementRepository, LegacyImportService, LegacyChapterImportService, StorageAdminService],
  exports: [CatalogService, CatalogRepository],
})
export class CatalogModule {}
