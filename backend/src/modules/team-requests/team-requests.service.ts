import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { RequestContext } from "../../common/middleware/request-context.middleware";
import { CatalogRepository } from "../catalog/catalog.repository";
import { CatalogService } from "../catalog/catalog.service";
import { slugify, TEAM_MANAGER_ROLES, uniqueSlug } from "../catalog/catalog.util";
import { StorageService } from "../images/storage/storage.interface";
import { isEffectivelyBanned } from "../moderation/moderation.util";
import { NotificationsService } from "../notifications/notifications.service";
import { TeamActivityService } from "../team-activity/team-activity.service";
import type { ReviewTeamRequestDto, TeamRequestDto } from "./dto/team-request.dto";
import { TeamRequestsRepository, type NewTeamRequest } from "./team-requests.repository";

/** Requests a member may have waiting at once, and may send in a day: a queue for the managers, not a place to try names out. */
const MAX_OPEN_REQUESTS = 2;
const REQUESTS_PER_DAY = 3;
const DAY_MS = 86_400_000;
const MANAGERS_TOLD = 20;

/** A team logo is a small square, whatever was chosen. */
const LOGO_SIZE = 256;
const LOGO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
/** The statuses in which the requester may still change the request (and so its logo). */
const EDITABLE = new Set(["pending", "needs_modification"]);

/** Where a request can go from where it is. Rejected and archived are final. */
const TRANSITIONS: Record<string, readonly string[]> = {
  pending: ["approved", "rejected", "needs_modification"],
  needs_modification: ["approved", "rejected", "needs_modification"],
  approved: ["suspended", "archived"],
  suspended: ["approved", "archived"],
  rejected: [],
  archived: [],
};

type RequestRow = NonNullable<Awaited<ReturnType<TeamRequestsRepository["findById"]>>>;

/**
 * Asking to open a team. A member sends a request; the site's team managers approve it (which creates the team, with the
 * requester as its leader and the wanted roles as its open positions), turn it down, ask for changes, or later suspend or
 * archive the team it made. Who may decide is checked here against the account's current role, never against the browser.
 */
@Injectable()
export class TeamRequestsService {
  private readonly log = new Logger(TeamRequestsService.name);

  constructor(
    private readonly repo: TeamRequestsRepository,
    private readonly catalog: CatalogService,
    private readonly catalogRepo: CatalogRepository,
    private readonly notifications: NotificationsService,
    private readonly activity: TeamActivityService,
    private readonly storage: StorageService
  ) {}

  async create(actorId: string, dto: TeamRequestDto) {
    const actor = await this.requireActor(actorId);
    const fields = toRequestFields(dto);
    if ((await this.repo.countOpen(actorId)) >= MAX_OPEN_REQUESTS) {
      throw new ConflictException({ code: "too_many_open_requests", message: "You already have requests waiting for a decision." });
    }
    if ((await this.repo.countSince(actorId, new Date(Date.now() - DAY_MS))) >= REQUESTS_PER_DAY) {
      throw new HttpException({ code: "too_many_requests", message: "Too many requests today. Try again tomorrow." }, HttpStatus.TOO_MANY_REQUESTS);
    }
    await this.requireFreeName(fields.teamName);

    const row = await this.repo.create({ requesterId: actorId, ...fields });
    await this.tellManagers(row, actor.displayName ?? actor.username);
    return toDto(row);
  }

  async mine(actorId: string) {
    return { items: (await this.repo.listMine(actorId)).map(toDto) };
  }

  async list(actorId: string, status: string | undefined) {
    await this.requireManager(actorId);
    return { items: (await this.repo.listAll(status)).map(toDto) };
  }

  /** The requester's changes after being asked for them: the request goes back to waiting. */
  async resubmit(actorId: string, id: string, dto: TeamRequestDto) {
    const actor = await this.requireActor(actorId);
    const request = await this.requireRequest(id);
    if (request.requesterId !== actorId) throw new NotFoundException({ code: "request_not_found", message: "This request does not exist." });
    if (request.status !== "needs_modification") {
      throw new ConflictException({ code: "not_awaiting_changes", message: "Only a request that was sent back for changes can be resent." });
    }
    const fields = toRequestFields(dto);
    await this.requireFreeName(fields.teamName);
    const row = await this.repo.resubmit(id, fields);
    await this.tellManagers(row, actor.displayName ?? actor.username);
    return toDto(row);
  }

  /** The logo, picked from the requester's device: cropped to a square, re-encoded as a small WebP, kept with the request. */
  async setLogo(actorId: string, id: string, file: Express.Multer.File | undefined) {
    await this.requireActor(actorId);
    const request = await this.requireOwnEditable(actorId, id);
    if (!file) throw new BadRequestException({ code: "missing_file", message: "No image file was uploaded." });
    if (!LOGO_TYPES.has(file.mimetype)) {
      throw new BadRequestException({ code: "unsupported_image_type", message: "Please upload a JPEG, PNG, WebP or GIF image." });
    }
    let data: Buffer;
    try {
      data = await sharp(file.buffer).resize(LOGO_SIZE, LOGO_SIZE, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
    } catch {
      throw new BadRequestException({ code: "invalid_image", message: "This file could not be read as an image." });
    }
    await this.repo.setLogo(request.id, data, "image/webp");
    return toDto(await this.requireRequest(id));
  }

  async removeLogo(actorId: string, id: string) {
    await this.requireActor(actorId);
    const request = await this.requireOwnEditable(actorId, id);
    await this.repo.removeLogo(request.id);
    return toDto(await this.requireRequest(id));
  }

  /** For the requester and the site's team managers only. */
  async logoImage(actorId: string, id: string) {
    const actor = await this.requireActor(actorId);
    const request = await this.requireRequest(id);
    if (request.requesterId !== actorId && !TEAM_MANAGER_ROLES.has(actor.role)) {
      throw new NotFoundException({ code: "request_not_found", message: "This request does not exist." });
    }
    const logo = await this.repo.findLogo(id);
    if (!logo) throw new NotFoundException({ code: "image_not_found", message: "This request has no logo." });
    return { data: Buffer.from(logo.data), mimeType: logo.mimeType };
  }

  async review(actorId: string, id: string, dto: ReviewTeamRequestDto, ctx: RequestContext) {
    const actor = await this.requireManager(actorId);
    const request = await this.requireRequest(id);
    if (!TRANSITIONS[request.status]?.includes(dto.status)) {
      throw new ConflictException({ code: "invalid_transition", message: `A request that is ${request.status} cannot become ${dto.status}.` });
    }

    const note = dto.note?.trim() || null;
    let teamId = request.createdTeamId;
    let slug: string | null = null;
    let reactivated = false;

    if (dto.status === "approved") {
      if (teamId) {
        await this.catalogRepo.updateTeam(teamId, { status: "active" });
        slug = (await this.catalogRepo.findTeamById(teamId))?.slug ?? null;
        reactivated = true;
      } else {
        await this.requireFreeName(request.teamName, "The team name was taken since the request was sent; ask the requester to change it.");
        const team = await this.createTeamFor(request);
        teamId = team.id;
        slug = team.slug;
      }
    } else if ((dto.status === "suspended" || dto.status === "archived") && teamId) {
      await this.catalogRepo.updateTeam(teamId, { status: dto.status });
      slug = (await this.catalogRepo.findTeamById(teamId))?.slug ?? null;
    }

    const updated = await this.repo.decide(id, { status: dto.status, note, reviewedById: actor.id, createdTeamId: teamId });
    if (teamId && dto.status === "approved" && !reactivated) await this.activity.record(teamId, "team_created", { actorId: actor.id });
    else if (teamId && (dto.status === "approved" || dto.status === "suspended" || dto.status === "archived")) {
      await this.activity.record(teamId, "team_status_changed", { actorId: actor.id, detail: dto.status === "approved" ? "active" : dto.status });
    }
    await this.repo.writeAuditLog({ actorId: actor.id, action: `team_request.${dto.status}`, target: id, ip: ctx.ip });
    this.catalog.invalidate();

    const [title, body, link] = decisionText(dto.status, request.teamName, id, slug, note, reactivated);
    await this.notifications.notify(request.requesterId, "team", title, body, link, teamId ?? id);
    return toDto(updated);
  }

  // ---- helpers ---------------------------------------------------------------

  /** The team the request asked for: its requester leads it and its wanted roles are open positions. */
  private async createTeamFor(request: RequestRow) {
    const slug = await uniqueSlug(slugify(request.teamName, "team"), (s) => this.catalogRepo.teamSlugTaken(s));
    const team = await this.catalogRepo.createTeam({
      slug,
      name: request.teamName,
      description: request.description,
      goals: request.goals,
      color: request.color ?? "#6D28D9",
      logoHue: hueOf(slug),
      discordUrl: request.discordUrl,
      websiteUrl: request.portfolioUrl,
      category: request.category,
      status: "active",
      recruiting: request.requiredPositions.length > 0,
      leaderId: request.requesterId,
    });
    await this.repo.openPositions(team.id, request.requiredPositions);
    await this.copyLogoTo(team.id, request.id);
    return team;
  }

  /** The logo the requester picked becomes the team's own. A hiccup here must not undo the approval: the leader can set it again from the dashboard. */
  private async copyLogoTo(teamId: string, requestId: string) {
    try {
      const logo = await this.repo.findLogo(requestId);
      if (!logo) return;
      const data = Buffer.from(logo.data);
      const storageKey = `catalog/${randomUUID()}.webp`;
      const { checksum } = await this.storage.put(storageKey, data);
      const asset = await this.catalogRepo.createAsset({ storageKey, checksum, mimeType: logo.mimeType, width: LOGO_SIZE, height: LOGO_SIZE });
      await this.catalogRepo.updateTeam(teamId, { logoAssetId: asset.id });
    } catch (error) {
      this.log.warn(`could not copy the request logo to team ${teamId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** The requester's own request, while it can still change. Anyone else's is "not found", as everywhere here. */
  private async requireOwnEditable(actorId: string, id: string) {
    const request = await this.requireRequest(id);
    if (request.requesterId !== actorId) throw new NotFoundException({ code: "request_not_found", message: "This request does not exist." });
    if (!EDITABLE.has(request.status)) {
      throw new ConflictException({ code: "request_not_editable", message: "This request can no longer be changed." });
    }
    return request;
  }

  private async tellManagers(row: RequestRow, from: string) {
    const managers = await this.repo.findManagers([...TEAM_MANAGER_ROLES], MANAGERS_TOLD);
    await Promise.all(
      managers
        .filter((m) => m.id !== row.requesterId)
        .map((m) => this.notifications.notify(m.id, "team", `طلب إنشاء فريق: ${row.teamName}`, `من ${from}`, "/admin/team-requests", row.id))
    );
  }

  private async requireFreeName(name: string, message = "A team with this name already exists.") {
    if (await this.repo.teamNameTaken(name)) throw new ConflictException({ code: "team_name_taken", message });
  }

  private async requireRequest(id: string) {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundException({ code: "request_not_found", message: "This request does not exist." });
    return row;
  }

  private async requireActor(actorId: string) {
    const actor = await this.repo.findActor(actorId);
    if (!actor) throw new NotFoundException({ code: "user_not_found", message: "Account no longer exists." });
    if (isEffectivelyBanned(actor)) throw new ForbiddenException({ code: "account_banned", message: "This account has been banned." });
    return actor;
  }

  private async requireManager(actorId: string) {
    const actor = await this.requireActor(actorId);
    if (!TEAM_MANAGER_ROLES.has(actor.role)) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "Only team managers can decide on team requests." });
    }
    return actor;
  }
}

function toRequestFields(dto: TeamRequestDto): Omit<NewTeamRequest, "requesterId"> {
  const teamName = dto.teamName.trim();
  const description = dto.description.trim();
  const goals = dto.goals.trim();
  if (teamName.length < 2 || !description || !goals) {
    throw new BadRequestException({ code: "invalid_request", message: "The name, description and goals cannot be empty." });
  }
  return {
    teamName,
    description,
    goals,
    discordUrl: dto.discordUrl ?? null,
    requiredPositions: dto.requiredPositions,
    category: dto.category,
    expectedMembers: dto.expectedMembers,
    previousExperience: dto.previousExperience?.trim() ?? "",
    portfolioUrl: dto.portfolioUrl ?? null,
    color: dto.color ?? null,
  };
}

/** A stable colour hue per team, so a team with no logo still gets a consistent avatar (same rule as CatalogAdminService). */
function hueOf(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return 250 + (h % 60);
}

function decisionText(status: string, teamName: string, requestId: string, slug: string | null, note: string | null, reactivated: boolean): [string, string, string] {
  const team = slug ? `/teams/${slug}` : "/teams";
  const tail = note ? ` ${note}` : "";
  switch (status) {
    case "approved":
      return reactivated
        ? [`أُعيد تفعيل فريق ${teamName}`, `عاد فريقك إلى العمل.${tail}`, team]
        : [`تمت الموافقة على فريق ${teamName}`, `أصبحت قائد الفريق ويمكنك إدارته وفتح باب التوظيف من صفحته.${tail}`, team];
    case "needs_modification":
      return [`طلب فريق ${teamName} يحتاج تعديلًا`, note ?? "عدّل الطلب وأعد إرساله.", `/teams/create?edit=${requestId}`];
    case "suspended":
      return [`عُلّق فريق ${teamName}`, note ?? "تواصل مع الإدارة لمعرفة السبب.", team];
    case "archived":
      return [`أُرشف فريق ${teamName}`, note ?? "أُوقف الفريق ولم يعد ظاهرًا في القوائم.", team];
    default:
      return [`رُفض طلب إنشاء فريق ${teamName}`, note ?? "لم يوافق المشرفون على الطلب.", "/teams/create"];
  }
}

function toDto(row: RequestRow) {
  return {
    id: row.id,
    requesterId: row.requesterId,
    requester: { username: row.requester.username, displayName: row.requester.displayName ?? row.requester.username },
    teamName: row.teamName,
    description: row.description,
    goals: row.goals,
    discordUrl: row.discordUrl ?? "",
    requiredPositions: row.requiredPositions,
    category: row.category,
    expectedMembers: row.expectedMembers,
    previousExperience: row.previousExperience,
    portfolioUrl: row.portfolioUrl ?? undefined,
    logoUrl: row.logo ? `/api/team-requests/${row.id}/logo?v=${row.logo.updatedAt.getTime()}` : undefined,
    color: row.color ?? undefined,
    status: row.status,
    reviewerNote: row.reviewerNote ?? undefined,
    reviewedBy: row.reviewedById ?? undefined,
    reviewedAt: row.reviewedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    createdTeamId: row.createdTeamId ?? undefined,
  };
}
