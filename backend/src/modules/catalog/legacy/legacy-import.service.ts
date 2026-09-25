import { BadGatewayException, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { StorageService } from "../../images/storage/storage.interface";
import { CatalogRepository } from "../catalog.repository";
import { CatalogService } from "../catalog.service";
import { slugify, uniqueSlug } from "../catalog.util";
import { EXTRA_TAGS, findCoverUrl, mapGroup, mapManga, mapTag, type LegacyGroup, type LegacyManga, type LegacyTag } from "./legacy-mapper";

const PAGE_SIZE = 100;
const MAX_PAGES = 20; // 2,000 records is far more than the old site holds; a safety stop, not a limit anyone should reach
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_COVER_BYTES = 10 * 1024 * 1024;
const USER_AGENT = "Mozilla/5.0 (compatible; LunexTeamImport/1.0)";

export interface ImportReport {
  tags: { created: number; existing: number };
  teams: { created: number; existing: number };
  series: { created: number; existing: number; skippedUnapproved: number };
  covers: { saved: number; missing: number; failed: number };
  errors: string[];
}

interface Envelope<T> {
  data: T[];
  total?: number;
}

/**
 * Copies the old lunexteam.com catalogue (tags, translation groups, series and
 * their covers) into this database, straight from the old site's public API.
 *
 * Safe to run more than once: everything is matched on the old site's id
 * (`legacyId`) and only ever CREATED — an existing series, team or tag is left
 * exactly as an editor may have changed it. Nothing is deleted. Chapters and
 * their page images are a separate, later step.
 *
 * Runs inside the backend rather than as a script so it can be triggered from
 * the admin UI by the owner without anyone needing database credentials.
 */
@Injectable()
export class LegacyImportService {
  private readonly logger = new Logger(LegacyImportService.name);
  private readonly origin = (process.env.LEGACY_SITE_ORIGIN ?? "https://lunexteam.com").replace(/\/+$/, "");

  constructor(
    private readonly repo: CatalogRepository,
    private readonly catalog: CatalogService,
    private readonly storage: StorageService
  ) {}

  async importCatalog(options: { covers?: boolean } = {}): Promise<ImportReport> {
    const report: ImportReport = {
      tags: { created: 0, existing: 0 },
      teams: { created: 0, existing: 0 },
      series: { created: 0, existing: 0, skippedUnapproved: 0 },
      covers: { saved: 0, missing: 0, failed: 0 },
      errors: [],
    };

    await this.importTags(report);
    await this.importTeams(report);
    await this.importSeries(report);
    if (options.covers !== false) await this.importCovers(report);

    this.catalog.invalidate();
    this.logger.log(`Legacy import done: ${JSON.stringify({ ...report, errors: report.errors.length })}`);
    return report;
  }

  // ---- tags ------------------------------------------------------------------

  private async importTags(report: ImportReport) {
    const legacy = await this.fetchAll<LegacyTag>("/v2/manga/tag");
    const wanted = [
      ...legacy.map(mapTag),
      ...EXTRA_TAGS.map((t) => ({ legacyId: undefined, slug: slugify(t.nameEn, "tag"), ...t })),
    ];

    for (const tag of wanted) {
      try {
        const existing = await this.repo.findTagsBySlugs([tag.slug]);
        if (existing.length > 0) {
          report.tags.existing++;
          continue;
        }
        await this.repo.createTag({ slug: tag.slug, nameEn: tag.nameEn, nameAr: tag.nameAr, group: tag.group, legacyId: tag.legacyId });
        report.tags.created++;
      } catch (error) {
        this.fail(report, `tag ${tag.nameEn}`, error);
      }
    }
  }

  // ---- teams -----------------------------------------------------------------

  private async importTeams(report: ImportReport) {
    const legacy = await this.fetchAll<LegacyGroup>("/v2/groups");
    for (const group of legacy) {
      try {
        const mapped = mapGroup(group);
        if (await this.repo.findTeamByLegacyId(mapped.legacyId)) {
          report.teams.existing++;
          continue;
        }
        const slug = await uniqueSlug(mapped.slug, (s) => this.repo.teamSlugTaken(s));
        await this.repo.createTeam({
          slug,
          name: mapped.name,
          description: mapped.description,
          goals: "",
          color: "#6D28D9",
          logoHue: this.hueOf(slug),
          discordUrl: mapped.discordUrl,
          websiteUrl: mapped.websiteUrl,
          category: "mixed",
          status: mapped.status,
          recruiting: false,
          leaderId: null, // the old leader's account can't be carried over; an administrator assigns one once they register here
          legacyId: mapped.legacyId,
          createdAt: mapped.createdAt,
        });
        report.teams.created++;
      } catch (error) {
        this.fail(report, `team ${group.attributes.name}`, error);
      }
    }
  }

  // ---- series ----------------------------------------------------------------

  private async importSeries(report: ImportReport) {
    const legacy = await this.fetchAll<LegacyManga>("/v2/manga");
    const tagsByLegacyId = new Map((await this.repo.listTags()).flatMap((t) => (t.legacyId ? [[t.legacyId, t.id] as const] : [])));

    for (const manga of legacy) {
      try {
        const mapped = mapManga(manga);
        if (!mapped.approved) {
          report.series.skippedUnapproved++;
          continue;
        }
        if (await this.repo.findSeriesByLegacyId(mapped.legacyId)) {
          report.series.existing++;
          continue;
        }

        const teamId = await this.teamOf(mapped.legacyId);
        const slug = await uniqueSlug(slugify(mapped.titleEn || mapped.titleAr, "series"), (s) => this.repo.seriesSlugTaken(s));
        await this.repo.createSeries({
          slug,
          titleAr: mapped.titleAr,
          titleEn: mapped.titleEn,
          alternativeTitles: mapped.alternativeTitles,
          synopsis: mapped.synopsis,
          type: mapped.type,
          status: mapped.status,
          country: mapped.country,
          author: "",
          artist: "",
          year: mapped.year,
          contentRating: mapped.contentRating,
          teamId,
          isFeatured: false,
          isRecommended: false,
          state: "approved",
          legacyId: mapped.legacyId,
          createdAt: mapped.createdAt,
          tagIds: mapped.tagLegacyIds.flatMap((id) => (tagsByLegacyId.has(id) ? [tagsByLegacyId.get(id) as string] : [])),
        });
        report.series.created++;
      } catch (error) {
        this.fail(report, `series ${manga.id}`, error);
      }
    }
  }

  /** The group that published a series' first chapter, as a team id here — the closest thing the old API has to "who owns this series". */
  private async teamOf(legacySeriesId: string): Promise<string | null> {
    try {
      const feed = await this.getJson<Envelope<{ relationships?: { id: string; type: string }[] }>>(`/v2/manga/${legacySeriesId}/feed?limit=1`);
      const groupId = feed.data[0]?.relationships?.find((r) => r.type === "scanlation_group")?.id;
      return groupId ? ((await this.repo.findTeamByLegacyId(groupId))?.id ?? null) : null;
    } catch {
      return null; // a series without a known group is still worth importing
    }
  }

  // ---- covers ----------------------------------------------------------------

  private async importCovers(report: ImportReport) {
    for (const series of await this.repo.listImportedSeriesWithoutCover()) {
      try {
        const html = await this.getText(`${this.origin}/title/${series.legacyId}`);
        const url = findCoverUrl(html);
        if (!url) {
          report.covers.missing++;
          continue;
        }
        const source = await this.getBuffer(url);
        const data = await sharp(source).resize(600, 900, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
        const storageKey = `catalog/${randomUUID()}.webp`;
        const { checksum } = await this.storage.put(storageKey, data);
        const asset = await this.repo.createAsset({ storageKey, checksum, mimeType: "image/webp", width: 600, height: 900 });
        await this.repo.updateSeries(series.id, { coverAssetId: asset.id });
        report.covers.saved++;
      } catch (error) {
        report.covers.failed++;
        this.fail(report, `cover ${series.legacyId}`, error);
      }
    }
  }

  // ---- http ------------------------------------------------------------------

  /** Follows the old API's limit/offset paging until it has everything. */
  private async fetchAll<T>(path: string): Promise<T[]> {
    const all: T[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const separator = path.includes("?") ? "&" : "?";
      const body = await this.getJson<Envelope<T>>(`${path}${separator}limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`);
      all.push(...body.data);
      if (body.data.length < PAGE_SIZE || (body.total !== undefined && all.length >= body.total)) break;
    }
    return all;
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await this.request(`${this.origin}/api${path}`);
    return (await res.json()) as T;
  }

  private async getText(url: string): Promise<string> {
    return (await this.request(url)).text();
  }

  private async getBuffer(url: string): Promise<Buffer> {
    const res = await this.request(url);
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_COVER_BYTES) throw new Error("image too large");
    const data = Buffer.from(await res.arrayBuffer());
    if (data.length > MAX_COVER_BYTES) throw new Error("image too large");
    return data;
  }

  private async request(url: string): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
        if (res.ok) return res;
        lastError = new Error(`${url} answered ${res.status}`);
        if (res.status < 500) break; // a 4xx will not get better by asking again
      } catch (error) {
        lastError = error;
      }
    }
    throw new BadGatewayException({
      code: "legacy_unreachable",
      message: `Could not read the old site: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    });
  }

  private fail(report: ImportReport, what: string, error: unknown) {
    const message = `${what}: ${error instanceof Error ? error.message : String(error)}`;
    this.logger.warn(message);
    report.errors.push(message);
  }

  private hueOf(text: string): number {
    let h = 0;
    for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return 250 + (h % 60);
  }
}

