import { Module } from "@nestjs/common";
import { ImagesModule } from "../images/images.module";
import { CatalogAdminController } from "./catalog-admin.controller";
import { CatalogAdminService } from "./catalog-admin.service";
import { CatalogController } from "./catalog.controller";
import { CatalogRepository } from "./catalog.repository";
import { CatalogService } from "./catalog.service";
import { LegacyImportController } from "./legacy/legacy-import.controller";
import { LegacyImportService } from "./legacy/legacy-import.service";

/** ImagesModule exports StorageService, so covers and logos live behind the same swappable backend as chapter pages. */
@Module({
  imports: [ImagesModule],
  controllers: [CatalogController, CatalogAdminController, LegacyImportController],
  providers: [CatalogService, CatalogAdminService, CatalogRepository, LegacyImportService],
  exports: [CatalogService, CatalogRepository],
})
export class CatalogModule {}
