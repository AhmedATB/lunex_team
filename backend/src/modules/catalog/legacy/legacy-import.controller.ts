import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsBoolean, IsOptional } from "class-validator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AccessTokenPayload } from "../../../common/guards/jwt-auth.guard";
import { CatalogRepository } from "../catalog.repository";
import { LegacyChapterImportService } from "./legacy-chapter-import.service";
import { LegacyImportService } from "./legacy-import.service";
import { StorageAdminService } from "./storage-admin.service";

class ImportOptionsDto {
  @IsOptional()
  @IsBoolean()
  covers?: boolean;
}

/** Owner only, checked against the database, not the token. The import reads the old site and writes to this one, so it is the most powerful button in the admin. */
@Controller("v1/catalog/import")
export class LegacyImportController {
  constructor(
    private readonly importer: LegacyImportService,
    private readonly chapterImporter: LegacyChapterImportService,
    private readonly storageAdmin: StorageAdminService,
    private readonly repo: CatalogRepository
  ) {}

  private async assertOwner(actor: AccessTokenPayload) {
    const user = await this.repo.findActor(actor.sub);
    if (!user || user.role !== "owner") {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "Only the owner can do this." });
    }
  }

  @Post("legacy")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  async run(@Body() dto: ImportOptionsDto, @CurrentUser() actor: AccessTokenPayload) {
    await this.assertOwner(actor);
    return this.importer.importCatalog({ covers: dto.covers });
  }

  /** Starts the chapter import on the server (it keeps going with the page closed) and returns its status. */
  @Post("legacy/chapters/start")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  async startChapters(@CurrentUser() actor: AccessTokenPayload) {
    await this.assertOwner(actor);
    return this.chapterImporter.startJob();
  }

  @Get("legacy/chapters/status")
  @HttpCode(HttpStatus.OK)
  async chaptersStatus(@CurrentUser() actor: AccessTokenPayload) {
    await this.assertOwner(actor);
    return this.chapterImporter.jobStatus();
  }

  @Get("storage")
  @HttpCode(HttpStatus.OK)
  async storageStatus(@CurrentUser() actor: AccessTokenPayload) {
    await this.assertOwner(actor);
    return this.storageAdmin.status();
  }

  @Post("storage/copy-to-r2")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  async copyToR2(@CurrentUser() actor: AccessTokenPayload) {
    await this.assertOwner(actor);
    return this.storageAdmin.copyToR2();
  }
}
