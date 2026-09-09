import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import sharp from "sharp";
import { ChaptersService } from "../chapters/chapters.service";
import { LegacyImportRepository } from "./legacy-import.repository";
import { LegacySourceClient, type LegacyChapter, type LegacyManga } from "./legacy-source.client";

/**
 * Stricter than ChaptersService's CAN_PUBLISH_GLOBAL_ROLES — this pulls in
 * bulk external content, not a single upload. Duplicated rather than
 * shared, same convention as every other role-set in this backend
 * (ChaptersService/UsersService) since the frontend and backend don't share
 * a types package.
 */
const LEGACY_IMPORT_ROLES = new Set(["owner", "super_administrator"]);

/** Confirmed present in the real feed data (see the plan's spike-test) — the only language this pipeline imports. */
const IMPORT_TRANSLATED_LANGUAGE = "ar";

const DEFAULT_LIST_LIMIT = 20;
const DEFAULT_CHAPTER_LIMIT = 5;
const MAX_COVER_DIMENSION = 1600;

export interface PageResult {
  succeeded: number;
  warnings: number;
  failed: number;
  total: number;
  nextOffset: number;
  hasMore: boolean;
}

@Injectable()
export class LegacyImportService {
  constructor(
    private readonly repo: LegacyImportRepository,
    private readonly source: LegacySourceClient,
    private readonly chapters: ChaptersService
  ) {}

  private assertCanImport(role: string) {
    if (!LEGACY_IMPORT_ROLES.has(role)) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot run the legacy import." });
    }
  }

  /** Small dataset (~8+ teams) — loops internally to exhaustion rather than exposing pagination for this one. */
  async importTeams(role: string) {
    this.assertCanImport(role);
    let offset = 0;
    let succeeded = 0;
    let failed = 0;
    while (true) {
      const page = await this.source.listGroups(100, offset);
      for (const group of page.data) {
        try {
          await this.repo.upsertTeam({
            externalId: group.id,
            name: group.attributes.name,
            description: group.attributes.description ?? null,
            isOfficial: Boolean(group.attributes.official),
            isVerified: Boolean(group.attributes.verified),
            isInactive: Boolean(group.attributes.inactive),
          });
          succeeded++;
        } catch {
          failed++;
        }
      }
      offset += page.data.length;
      if (page.data.length === 0 || offset >= (page.total ?? offset)) break;
    }
    return { succeeded, failed };
  }

  async importSeriesPage(role: string, limit = DEFAULT_LIST_LIMIT, offset = 0): Promise<PageResult> {
    this.assertCanImport(role);
    const page = await this.source.listManga(limit, offset);
    let succeeded = 0;
    let warnings = 0;
    let failed = 0;

    for (const manga of page.data) {
      try {
        const imported = await this.importOneSeries(manga);
        if (imported) succeeded++;
        else warnings++;
      } catch {
        failed++;
      }
    }

    const total = page.total ?? offset + page.data.length;
    const nextOffset = offset + page.data.length;
    return { succeeded, warnings, failed, total, nextOffset, hasMore: nextOffset < total };
  }

  private async importOneSeries(manga: LegacyManga): Promise<boolean> {
    if (manga.attributes.state && manga.attributes.state !== "approved") {
      return false; // not a failure — just not ready for import yet
    }

    const coverRel = manga.relationships?.find((r) => r.type === "cover_art");
    const coverFileName = coverRel?.attributes?.fileName;

    let coverImage: Buffer | null = null;
    let coverMimeType: string | null = null;
    if (coverFileName) {
      try {
        const url = this.source.getCoverUrl(manga.id, coverFileName);
        const raw = await this.source.downloadBytes(url);
        coverImage = await sharp(raw)
          .resize(MAX_COVER_DIMENSION, MAX_COVER_DIMENSION, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();
        coverMimeType = "image/webp";
      } catch {
        // Soft failure — the series still gets imported without a cover, re-run later to backfill.
      }
    }

    await this.repo.upsertSeries({
      externalId: manga.id,
      title: manga.attributes.title.ar ?? manga.attributes.title.en ?? Object.values(manga.attributes.title)[0] ?? manga.id,
      altTitles: manga.attributes.altTitles ?? null,
      descriptionAr: manga.attributes.description?.ar ?? null,
      descriptionEn: manga.attributes.description?.en ?? null,
      status: manga.attributes.status ?? "ongoing",
      originalLanguage: manga.attributes.originalLanguage ?? null,
      contentRating: manga.attributes.contentRating ?? null,
      publicationDemographic: manga.attributes.publicationDemographic ?? null,
      year: manga.attributes.year ?? null,
      tags: manga.attributes.tags ?? null,
      coverImage,
      coverMimeType,
    });
    return true;
  }

  async importChaptersPage(
    role: string,
    seriesExternalId: string,
    limit = DEFAULT_CHAPTER_LIMIT,
    offset = 0
  ): Promise<PageResult> {
    this.assertCanImport(role);
    const series = await this.repo.findSeriesByExternalId(seriesExternalId);
    if (!series) {
      throw new NotFoundException({ code: "series_not_imported", message: "Import this series before its chapters." });
    }

    const page = await this.source.getMangaFeed(seriesExternalId, limit, offset);

    let succeeded = 0;
    let warnings = 0;
    let failed = 0;

    for (const chapter of page.data) {
      if (chapter.attributes.translatedLanguage !== IMPORT_TRANSLATED_LANGUAGE) {
        warnings++; // a different language edition of this chapter — not imported by this pipeline
        continue;
      }
      try {
        const imported = await this.importOneChapter(series.id, chapter);
        if (imported) succeeded++;
        else warnings++;
      } catch {
        failed++;
      }
    }

    const total = page.total ?? offset + page.data.length;
    const nextOffset = offset + page.data.length;
    return { succeeded, warnings, failed, total, nextOffset, hasMore: nextOffset < total };
  }

  private async importOneChapter(seriesId: string, chapter: LegacyChapter): Promise<boolean> {
    const existing = await this.repo.findChapterByExternalId(chapter.id);
    if (existing) return false; // already imported — not a failure, just nothing to do

    const number = Number(chapter.attributes.chapter);
    if (!Number.isFinite(number)) return false;

    const groupRel = chapter.relationships?.find((r) => r.type === "scanlation_group");
    const team = groupRel ? await this.repo.findTeamByExternalId(groupRel.id) : null;

    let created: { id: string };
    try {
      created = await this.chapters.create("owner", {
        seriesId,
        teamId: team?.id ?? "", // no FK — an unresolved/missing team is a legitimate value here, not an error
        number,
        title: chapter.attributes.title || `Chapter ${chapter.attributes.chapter}`,
      });
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return false; // duplicate [seriesId, number] — treat as already-there, not a hard failure
      }
      throw err;
    }

    await this.repo.markChapterExternalId(created.id, chapter.id);

    const readInfo = await this.source.getChapterReadInfo(chapter.id);
    let pageNumber = 1;
    for (const fileName of readInfo.chapter.data) {
      const url = `${readInfo.baseUrl}/data/${readInfo.chapter.hash}/${fileName}`;
      try {
        const bytes = await this.source.downloadBytes(url);
        await this.chapters.uploadPage("owner", created.id, pageNumber, {
          buffer: bytes,
        } as Express.Multer.File);
      } catch {
        // One bad page image doesn't abort the rest of the chapter — it stays a gap to backfill on re-import.
      }
      pageNumber++;
    }

    return true;
  }

  async status(role: string) {
    this.assertCanImport(role);
    const [teams, series, importedChapters] = await Promise.all([
      this.repo.countTeams(),
      this.repo.countSeries(),
      this.repo.countImportedChapters(),
    ]);
    return { teams, series, importedChapters };
  }
}
