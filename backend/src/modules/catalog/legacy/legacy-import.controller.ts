import { Body, Controller, ForbiddenException, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsBoolean, IsOptional } from "class-validator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AccessTokenPayload } from "../../../common/guards/jwt-auth.guard";
import { CatalogRepository } from "../catalog.repository";
import { LegacyImportService } from "./legacy-import.service";

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
    private readonly repo: CatalogRepository
  ) {}

  @Post("legacy")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  async run(@Body() dto: ImportOptionsDto, @CurrentUser() actor: AccessTokenPayload) {
    const user = await this.repo.findActor(actor.sub);
    if (!user || user.role !== "owner") {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "Only the owner can import from the old site." });
    }
    return this.importer.importCatalog({ covers: dto.covers });
  }
}
