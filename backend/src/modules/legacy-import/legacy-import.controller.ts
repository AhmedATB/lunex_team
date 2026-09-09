import { Body, Controller, Get, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AccessTokenPayload } from "../../common/guards/jwt-auth.guard";
import { ImportAllChaptersDto } from "./dto/import-all-chapters.dto";
import { ImportChaptersPageDto } from "./dto/import-chapters-page.dto";
import { ImportPageDto } from "./dto/import-page.dto";
import { LegacyImportService } from "./legacy-import.service";

/**
 * Owner/super-admin-only, driven by hand from the browser during the
 * one-time migration off the old site — no @Public() routes here, the
 * global JwtAuthGuard requires a real session and LegacyImportService
 * re-checks the role server-side too.
 */
@Controller("v1/admin/legacy-import")
export class LegacyImportController {
  constructor(private readonly service: LegacyImportService) {}

  @Post("teams")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  importTeams(@CurrentUser() actor: AccessTokenPayload) {
    return this.service.importTeams(actor.role);
  }

  @Post("series")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  importSeries(@Body() dto: ImportPageDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.service.importSeriesPage(actor.role, dto.limit, dto.offset);
  }

  @Post("chapters")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  importChapters(@Body() dto: ImportChaptersPageDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.service.importChaptersPage(actor.role, dto.seriesExternalId, dto.limit, dto.offset);
  }

  /** Loops importChaptersPage internally for one series — the practical way to drive the real migration, one call per series instead of one per handful of chapters. */
  @Post("chapters/all")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  importAllChapters(@Body() dto: ImportAllChaptersDto, @CurrentUser() actor: AccessTokenPayload) {
    return this.service.importAllChaptersForSeries(actor.role, dto.seriesExternalId);
  }

  @Get("status")
  status(@CurrentUser() actor: AccessTokenPayload) {
    return this.service.status(actor.role);
  }
}
