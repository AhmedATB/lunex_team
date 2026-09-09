import { Module } from "@nestjs/common";
import { ChaptersModule } from "../chapters/chapters.module";
import { LegacyImportController } from "./legacy-import.controller";
import { LegacyImportRepository } from "./legacy-import.repository";
import { LegacyImportService } from "./legacy-import.service";
import { LegacySourceClient } from "./legacy-source.client";

@Module({
  imports: [ChaptersModule],
  controllers: [LegacyImportController],
  providers: [LegacyImportService, LegacyImportRepository, LegacySourceClient],
})
export class LegacyImportModule {}
