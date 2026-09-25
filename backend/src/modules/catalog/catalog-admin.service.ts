import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { RequestContext } from "../../common/middleware/request-context.middleware";
import { isEffectivelyBanned } from "../moderation/moderation.util";
import { StorageService } from "../images/storage/storage.interface";
import { CatalogRepository } from "./catalog.repository";
import { CatalogService } from "./catalog.service";
import { EMPTY_STATS, slugify, toNewsDto, toSeriesDto, toTagDto, toTeamDto, uniqueSlug, type SeriesRow, type TeamRow } from "./catalog.util";
import type {
  CreateNewsDto,
  CreateSeriesDto,
  CreateTagDto,
  CreateTeamDto,
  UpdateNewsDto,
  UpdateSeriesDto,
  UpdateTeamDto,
} from "./dto/catalog.dto";

/** Global roles by what they may manage; mirrors the frontend's rbac.ts (manage_series, edit_team, create_announcements). */
const SERIES_EDITORS: ReadonlySet<string> = new Set(["owner", "super_administrator", "editor"]);
const TEAM_MANAGERS: ReadonlySet<string> = new Set(["owner", "super_administrator", "global_team_manager"]);
const NEWS_EDITORS: ReadonlySet<string> = new Set(["owner", "super_administrator", "news_manager"]);
const TEAM_LEAD_ROLES: ReadonlySet<string> = new Set(["team_leader", "assistant_leader", "team_administrator"]);

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const IMAGE_SIZES = {
  cover: { width: 600, height: 900 },
  banner: { width: 1600, height: 600 },
  logo: { width: 256, height: 256 },
  news: { width: 1200, height: 630 },
} as const;

interface Actor {
  id: string;
  role: string;
}

/** Everything that changes the catalogue: series, teams, tags, news and their pictures. Each method decides who may do it. */
@Injectable()
export class CatalogAdminService {
  constructor(
    private readonly repo: CatalogRepository,
    private readonly catalog: CatalogService,
    private readonly storage: StorageService
  ) {}

  // ---- series ----------------------------------------------------------------

  async createSeries(actorId: string, dto: CreateSeriesDto, ctx: RequestContext) {
    const actor = await this.requireActor(actorId);
    const teamId = dto.teamId ? (await this.requireTeam(dto.teamId)).id : null;
    if (!SERIES_EDITORS.has(actor.role) && !(teamId && (await this.isTeamLead(actor.id, teamId)))) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot add series." });
    }
    const isGlobal = SERIES_EDITORS.has(actor.role);

    const tagIds = await this.resolveTags(dto.tagSlugs ?? []);
    const slug = await uniqueSlug(slugify(dto.titleEn || dto.titleAr, "series"), (s) => this.repo.seriesSlugTaken(s));
    const row = await this.repo.createSeries({
      slug,
      titleAr: dto.titleAr.trim(),
      titleEn: dto.titleEn?.trim() ?? "",
      alternativeTitles: dto.alternativeTitles ?? [],
      synopsis: dto.synopsis ?? "",
      type: dto.type ?? "manhwa",
      status: dto.status ?? "ongoing",
      country: dto.country ?? "kr",
      author: dto.author ?? "",
      artist: dto.artist ?? "",
      year: dto.year ?? null,
      contentRating: dto.contentRating ?? "safe",
      teamId,
      // Editorial flags are a global editor's call, never a team lead's.
      isFeatured: isGlobal ? (dto.isFeatured ?? false) : false,
      isRecommended: isGlobal ? (dto.isRecommended ?? false) : false,
      state: "approved",
      tagIds,
    });

    await this.audit(actor, "catalog.series_created", row.id, ctx);
    this.catalog.invalidate();
    return toSeriesDto(row as SeriesRow, EMPTY_STATS);
  }

  async updateSeries(actorId: string, id: string, dto: UpdateSeriesDto, ctx: RequestContext) {
    const actor = await this.requireActor(actorId);
    const series = await this.requireSeries(id);
    const isGlobal = SERIES_EDITORS.has(actor.role);
    if (!isGlobal && !(series.teamId && (await this.isTeamLead(actor.id, series.teamId)))) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot edit this series." });
    }
    const editorial = dto.isFeatured !== undefined || dto.isRecommended !== undefined || dto.state !== undefined || dto.teamId !== undefined;
    if (editorial && !isGlobal) {
      throw new ForbiddenException({ code: "global_editor_only", message: "Only an editor can change featuring, visibility or the team." });
    }

    const tagIds = dto.tagSlugs ? await this.resolveTags(dto.tagSlugs) : undefined;
    const teamId = dto.teamId === undefined ? undefined : dto.teamId === "" ? null : (await this.requireTeam(dto.teamId)).id;

    const row = await this.repo.updateSeries(
      id,
      {
        titleAr: dto.titleAr?.trim(),
        titleEn: dto.titleEn?.trim(),
        alternativeTitles: dto.alternativeTitles,
        synopsis: dto.synopsis,
        type: dto.type,
        status: dto.status,
        country: dto.country,
        author: dto.author,
        artist: dto.artist,
        year: dto.year,
        contentRating: dto.contentRating,
        teamId,
        isFeatured: dto.isFeatured,
        isRecommended: dto.isRecommended,
        state: dto.state,
      },
      tagIds
    );
    await this.audit(actor, "catalog.series_updated", id, ctx);
    this.catalog.invalidate();
    const stats = await this.repo.statsFor([id]);
    return toSeriesDto(row as SeriesRow, stats.get(id) ?? EMPTY_STATS);
  }

  async deleteSeries(actorId: string, id: string, ctx: RequestContext): Promise<void> {
    const actor = await this.requireActor(actorId);
    if (!SERIES_EDITORS.has(actor.role)) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot delete series." });
    }
    await this.requireSeries(id);
    await this.repo.deleteSeriesCascade(id);
    await this.audit(actor, "catalog.series_deleted", id, ctx);
    this.catalog.invalidate();
  }

  async setSeriesImage(actorId: string, id: string, kind: "cover" | "banner", file: Express.Multer.File | undefined, ctx: RequestContext) {
    const actor = await this.requireActor(actorId);
    const series = await this.requireSeries(id);
    if (!SERIES_EDITORS.has(actor.role) && !(series.teamId && (await this.isTeamLead(actor.id, series.teamId)))) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot edit this series." });
    }
    const assetId = await this.storeImage(file, IMAGE_SIZES[kind]);
    const row = await this.repo.updateSeries(id, kind === "cover" ? { coverAssetId: assetId } : { bannerAssetId: assetId });
    await this.audit(actor, `catalog.series_${kind}_set`, id, ctx);
    this.catalog.invalidate();
    const stats = await this.repo.statsFor([id]);
    return toSeriesDto(row as SeriesRow, stats.get(id) ?? EMPTY_STATS);
  }

  // ---- tags ------------------------------------------------------------------

  async createTag(actorId: string, dto: CreateTagDto, ctx: RequestContext) {
    const actor = await this.requireActor(actorId);
    if (!SERIES_EDITORS.has(actor.role)) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot add tags." });
    }
    const slug = slugify(dto.nameEn, "tag");
    if ((await this.repo.findTagsBySlugs([slug])).length > 0) {
      throw new ConflictException({ code: "tag_exists", message: "A tag with this name already exists." });
    }
    const tag = await this.repo.createTag({ slug, nameEn: dto.nameEn.trim(), nameAr: dto.nameAr.trim(), group: dto.group ?? "genre" });
    await this.audit(actor, "catalog.tag_created", tag.id, ctx);
    this.catalog.invalidate();
    return toTagDto(tag);
  }

  // ---- teams -----------------------------------------------------------------

  async createTeam(actorId: string, dto: CreateTeamDto, ctx: RequestContext) {
    const actor = await this.requireActor(actorId);
    if (!TEAM_MANAGERS.has(actor.role)) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot create teams." });
    }
    const leaderId = dto.leaderUsername ? await this.userIdByUsername(dto.leaderUsername) : null;
    const slug = await uniqueSlug(slugify(dto.name, "team"), (s) => this.repo.teamSlugTaken(s));
    const row = await this.repo.createTeam({
      slug,
      name: dto.name.trim(),
      description: dto.description ?? "",
      goals: dto.goals ?? "",
      color: dto.color ?? "#6D28D9",
      logoHue: this.hueOf(slug),
      discordUrl: dto.discordUrl ?? null,
      websiteUrl: dto.websiteUrl ?? null,
      category: dto.category ?? "mixed",
      status: "active",
      recruiting: dto.recruiting ?? false,
      leaderId,
    });
    await this.audit(actor, "catalog.team_created", row.id, ctx);
    this.catalog.invalidate();
    return toTeamDto(row as TeamRow, row.members.length, null);
  }

  async updateTeam(actorId: string, id: string, dto: UpdateTeamDto, ctx: RequestContext) {
    const actor = await this.requireActor(actorId);
    const team = await this.requireTeam(id);
    const isManager = TEAM_MANAGERS.has(actor.role);
    if (!isManager && !(await this.isTeamLead(actor.id, team.id))) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot edit this team." });
    }
    if (!isManager && (dto.status !== undefined || dto.leaderUsername !== undefined)) {
      throw new ForbiddenException({ code: "global_manager_only", message: "Only a team manager can change a team's status or leader." });
    }

    const leaderId = dto.leaderUsername === undefined ? undefined : dto.leaderUsername === "" ? null : await this.userIdByUsername(dto.leaderUsername);
    const row = await this.repo.updateTeam(id, {
      name: dto.name?.trim(),
      description: dto.description,
      goals: dto.goals,
      color: dto.color,
      category: dto.category,
      discordUrl: dto.discordUrl,
      websiteUrl: dto.websiteUrl,
      recruiting: dto.recruiting,
      status: dto.status,
      leaderId,
    });
    await this.audit(actor, "catalog.team_updated", id, ctx);
    this.catalog.invalidate();
    return toTeamDto(row as TeamRow, 0, null);
  }

  async deleteTeam(actorId: string, id: string, ctx: RequestContext): Promise<void> {
    const actor = await this.requireActor(actorId);
    if (!TEAM_MANAGERS.has(actor.role)) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot delete teams." });
    }
    await this.requireTeam(id);
    await this.repo.deleteTeam(id); // its series keep existing, unassigned (FK SetNull)
    await this.audit(actor, "catalog.team_deleted", id, ctx);
    this.catalog.invalidate();
  }

  async setMember(actorId: string, teamId: string, userId: string, role: string, ctx: RequestContext): Promise<void> {
    const actor = await this.requireActor(actorId);
    await this.requireTeamManagement(actor, teamId);
    if (!(await this.repo.findPeople([userId])).length) {
      throw new NotFoundException({ code: "user_not_found", message: "User not found." });
    }
    await this.repo.setMember(teamId, userId, role);
    await this.audit(actor, "catalog.team_member_set", `${teamId}:${userId}:${role}`, ctx);
    this.catalog.invalidate();
  }

  async removeMember(actorId: string, teamId: string, userId: string, ctx: RequestContext): Promise<void> {
    const actor = await this.requireActor(actorId);
    await this.requireTeamManagement(actor, teamId);
    await this.repo.removeMember(teamId, userId);
    await this.audit(actor, "catalog.team_member_removed", `${teamId}:${userId}`, ctx);
    this.catalog.invalidate();
  }

  async setTeamLogo(actorId: string, id: string, file: Express.Multer.File | undefined, ctx: RequestContext) {
    const actor = await this.requireActor(actorId);
    await this.requireTeamManagement(actor, id);
    const assetId = await this.storeImage(file, IMAGE_SIZES.logo);
    const row = await this.repo.updateTeam(id, { logoAssetId: assetId });
    await this.audit(actor, "catalog.team_logo_set", id, ctx);
    this.catalog.invalidate();
    return toTeamDto(row as TeamRow, 0, null);
  }

  // ---- news ------------------------------------------------------------------

  async createNews(actorId: string, dto: CreateNewsDto, ctx: RequestContext) {
    const actor = await this.requireNewsEditor(actorId);
    const row = await this.repo.createNews({
      title: dto.title.trim(),
      excerpt: dto.excerpt ?? "",
      content: dto.content ?? "",
      category: dto.category ?? "news",
      authorId: actor.id,
      isPublished: dto.isPublished ?? true,
    });
    await this.audit(actor, "catalog.news_created", row.id, ctx);
    this.catalog.invalidate();
    return toNewsDto(row);
  }

  async updateNews(actorId: string, id: string, dto: UpdateNewsDto, ctx: RequestContext) {
    const actor = await this.requireNewsEditor(actorId);
    await this.requireNews(id);
    const row = await this.repo.updateNews(id, {
      title: dto.title?.trim(),
      excerpt: dto.excerpt,
      content: dto.content,
      category: dto.category,
      isPublished: dto.isPublished,
    });
    await this.audit(actor, "catalog.news_updated", id, ctx);
    this.catalog.invalidate();
    return toNewsDto(row);
  }

  async deleteNews(actorId: string, id: string, ctx: RequestContext): Promise<void> {
    const actor = await this.requireNewsEditor(actorId);
    await this.requireNews(id);
    await this.repo.deleteNews(id);
    await this.audit(actor, "catalog.news_deleted", id, ctx);
    this.catalog.invalidate();
  }

  async setNewsCover(actorId: string, id: string, file: Express.Multer.File | undefined, ctx: RequestContext) {
    const actor = await this.requireNewsEditor(actorId);
    await this.requireNews(id);
    const assetId = await this.storeImage(file, IMAGE_SIZES.news);
    const row = await this.repo.updateNews(id, { coverAssetId: assetId });
    await this.audit(actor, "catalog.news_cover_set", id, ctx);
    this.catalog.invalidate();
    return toNewsDto(row);
  }

  // ---- helpers ---------------------------------------------------------------

  /** Resizes to the target box (cropping to fill), re-encodes as WebP, stores it, and returns the new asset's id. */
  private async storeImage(file: Express.Multer.File | undefined, size: { width: number; height: number }): Promise<string> {
    if (!file) throw new BadRequestException({ code: "missing_file", message: "No image file was uploaded." });
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      throw new BadRequestException({ code: "unsupported_image_type", message: "Please upload a JPEG, PNG, WebP or GIF image." });
    }
    let data: Buffer;
    try {
      data = await sharp(file.buffer).resize(size.width, size.height, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
    } catch {
      throw new BadRequestException({ code: "invalid_image", message: "This file could not be read as an image." });
    }
    const storageKey = `catalog/${randomUUID()}.webp`;
    const { checksum } = await this.storage.put(storageKey, data);
    const asset = await this.repo.createAsset({ storageKey, checksum, mimeType: "image/webp", width: size.width, height: size.height });
    return asset.id;
  }

  private async resolveTags(slugs: string[]): Promise<string[]> {
    const unique = [...new Set(slugs)];
    if (unique.length === 0) return [];
    const tags = await this.repo.findTagsBySlugs(unique);
    const missing = unique.filter((s) => !tags.some((t) => t.slug === s));
    if (missing.length > 0) {
      throw new BadRequestException({ code: "unknown_tags", message: `Unknown tags: ${missing.join(", ")}` });
    }
    return tags.map((t) => t.id);
  }

  private async requireActor(actorId: string): Promise<Actor> {
    const actor = await this.repo.findActor(actorId);
    if (!actor) throw new NotFoundException({ code: "user_not_found", message: "Account no longer exists." });
    if (isEffectivelyBanned(actor)) throw new ForbiddenException({ code: "account_banned", message: "This account has been banned." });
    return { id: actor.id, role: actor.role };
  }

  private async requireNewsEditor(actorId: string): Promise<Actor> {
    const actor = await this.requireActor(actorId);
    if (!NEWS_EDITORS.has(actor.role)) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot manage news." });
    }
    return actor;
  }

  private async requireSeries(id: string) {
    const series = await this.repo.findSeriesById(id);
    if (!series) throw new NotFoundException({ code: "series_not_found", message: "This series does not exist." });
    return series;
  }

  private async requireTeam(id: string) {
    const team = await this.repo.findTeamById(id);
    if (!team) throw new NotFoundException({ code: "team_not_found", message: "This team does not exist." });
    return team;
  }

  private async requireNews(id: string) {
    const news = await this.repo.findNews(id);
    if (!news) throw new NotFoundException({ code: "news_not_found", message: "This post does not exist." });
    return news;
  }

  /** A team manager, or that team's own leader / assistant / administrator. */
  private async requireTeamManagement(actor: Actor, teamId: string) {
    const team = await this.requireTeam(teamId);
    if (!TEAM_MANAGERS.has(actor.role) && !(await this.isTeamLead(actor.id, team.id))) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "You cannot manage this team." });
    }
    return team;
  }

  private async isTeamLead(userId: string, teamId: string): Promise<boolean> {
    const team = await this.repo.findTeamById(teamId);
    if (team?.leaderId === userId) return true;
    const members = await this.repo.membersOfTeam(teamId);
    return members.some((m) => m.userId === userId && TEAM_LEAD_ROLES.has(m.role));
  }

  private async userIdByUsername(username: string): Promise<string> {
    const id = await this.repo.findUserIdByUsername(username);
    if (!id) throw new NotFoundException({ code: "user_not_found", message: `No account named ${username}.` });
    return id;
  }

  /** A stable colour hue per team, so a team with no logo still gets a consistent avatar. */
  private hueOf(text: string): number {
    let h = 0;
    for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return 250 + (h % 60);
  }

  private audit(actor: Actor, action: string, target: string, ctx: RequestContext) {
    return this.repo.writeAuditLog({ actorId: actor.id, action, target, ip: ctx.ip });
  }
}
