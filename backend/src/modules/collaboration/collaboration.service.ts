import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { RequestContext } from "../../common/middleware/request-context.middleware";
import { CatalogService } from "../catalog/catalog.service";
import { TEAM_LEAD_ROLES, TEAM_MANAGER_ROLES } from "../catalog/catalog.util";
import { isEffectivelyBanned } from "../moderation/moderation.util";
import { NotificationsService } from "../notifications/notifications.service";
import { TeamActivityService } from "../team-activity/team-activity.service";
import type { CreateCollaborationDto, RespondCollaborationDto } from "./dto/collaboration.dto";
import { CollaborationRepository, OPEN_STATUSES } from "./collaboration.repository";

const MAX_OPEN_REQUESTS = 10;
const LEADERS_TOLD = 10;

const TYPE_AR: Record<string, string> = {
  need_translator: "بحاجة مترجم",
  need_editor: "بحاجة محرر",
  need_proofreader: "بحاجة مدقق لغوي",
  need_qc: "بحاجة مراقب جودة",
  need_publisher: "بحاجة ناشر",
  need_complete_team_support: "بحاجة دعم فريق كامل",
  emergency_assistance: "مساعدة طارئة",
};

type TeamRow = NonNullable<Awaited<ReturnType<CollaborationRepository["findTeam"]>>>;
type RequestRow = NonNullable<Awaited<ReturnType<CollaborationRepository["findRequest"]>>>;
type Actor = NonNullable<Awaited<ReturnType<CollaborationRepository["findActor"]>>>;

/**
 * Teams helping each other: one asks another to help with one of its series, the asked team answers, and accepting makes it a
 * collaborator on that series (shown on the series' page and in the asked team's dashboard). Only a team's leaders act for it.
 */
@Injectable()
export class CollaborationService {
  constructor(
    private readonly repo: CollaborationRepository,
    private readonly catalog: CatalogService,
    private readonly notifications: NotificationsService,
    private readonly activity: TeamActivityService
  ) {}

  async create(actorId: string, dto: CreateCollaborationDto) {
    const actor = await this.requireActor(actorId);
    if (dto.fromTeamId === dto.toTeamId) throw new BadRequestException({ code: "same_team", message: "A team cannot ask itself." });
    const [from, to] = [await this.requireTeam(dto.fromTeamId), await this.requireTeam(dto.toTeamId)];
    if (!this.isLead(actor, from)) throw new ForbiddenException({ code: "insufficient_permissions", message: "Only the leaders of a team can ask for help on its behalf." });
    if (from.status !== "active" || to.status !== "active") {
      throw new ConflictException({ code: "team_not_active", message: "Both teams must be active." });
    }
    const series = await this.repo.findSeries(dto.seriesId);
    if (!series) throw new NotFoundException({ code: "series_not_found", message: "This series does not exist." });
    if (series.teamId !== from.id) throw new ForbiddenException({ code: "not_your_series", message: "A team can only ask for help with its own series." });
    if (await this.repo.findOpenDuplicate(from.id, to.id, series.id, dto.type)) {
      throw new ConflictException({ code: "duplicate_request", message: "This request was already sent and is waiting." });
    }
    if ((await this.repo.countOpenFrom(from.id)) >= MAX_OPEN_REQUESTS) {
      throw new ConflictException({ code: "too_many_open_requests", message: "Too many requests are waiting for an answer." });
    }

    const row = await this.repo.create({ fromTeamId: from.id, toTeamId: to.id, seriesId: series.id, type: dto.type, message: dto.message.trim(), createdById: actor.id });
    await this.tellLeaders(to, `طلب تعاون من فريق ${from.name}`, `${TYPE_AR[dto.type] ?? dto.type} — ${series.titleAr}`, `/teams/${to.slug}/dashboard`, row.id);
    await this.activity.record(from.id, "collaboration_sent", { actorId: actor.id, detail: to.name });
    await this.activity.record(to.id, "collaboration_received", { detail: from.name });
    return toDto(row);
  }

  /** Both directions for one team, for its leaders. */
  async list(actorId: string, teamId: string) {
    const actor = await this.requireActor(actorId);
    const team = await this.requireTeam(teamId);
    if (!this.isLead(actor, team)) throw new ForbiddenException({ code: "insufficient_permissions", message: "Only this team's leaders can see its collaboration requests." });
    const rows = await this.repo.listFor(teamId);
    return { incoming: rows.filter((r) => r.toTeamId === teamId).map(toDto), outgoing: rows.filter((r) => r.fromTeamId === teamId).map(toDto) };
  }

  async respond(actorId: string, id: string, dto: RespondCollaborationDto, ctx: RequestContext) {
    const actor = await this.requireActor(actorId);
    const request = await this.requireRequest(id);
    const to = await this.requireTeam(request.toTeamId);
    if (!this.isLead(actor, to)) throw new ForbiddenException({ code: "insufficient_permissions", message: "Only the leaders of the asked team can answer." });
    if (!OPEN_STATUSES.includes(request.status) || (request.status === "negotiating" && dto.status === "negotiating")) {
      throw new ConflictException({ code: "already_decided", message: "This request has already been decided." });
    }

    const updated = await this.repo.respond(id, { status: dto.status, respondedById: actor.id });
    if (dto.status === "accepted") {
      await this.repo.addCollaborator(request.seriesId, request.toTeamId);
      this.catalog.invalidate();
    }
    await this.repo.writeAuditLog({ actorId: actor.id, action: `collaboration.${dto.status}`, target: `${request.fromTeamId}:${request.toTeamId}:${request.seriesId}`, ip: ctx.ip });

    const from = await this.repo.findTeam(request.fromTeamId);
    if (from) {
      const [title, body] = answerText(dto.status, to.name, request.series.titleAr, dto.note?.trim() || null);
      await this.tellLeaders(from, title, body, `/teams/${from.slug}/dashboard`, id);
    }
    await this.activity.record(request.toTeamId, `collaboration_${dto.status}` as "collaboration_accepted", { actorId: actor.id, detail: request.fromTeam.name });
    await this.activity.record(request.fromTeamId, `collaboration_${dto.status}_by` as "collaboration_accepted_by", { detail: request.toTeam.name });
    return toDto(updated);
  }

  /** Ends a team's work on a series it does not own: the series' own leaders can, and so can the collaborating team's. */
  async removeCollaborator(actorId: string, seriesId: string, teamId: string): Promise<void> {
    const actor = await this.requireActor(actorId);
    const series = await this.repo.findSeries(seriesId);
    if (!series) throw new NotFoundException({ code: "series_not_found", message: "This series does not exist." });
    if (!(await this.repo.hasCollaborator(seriesId, teamId))) {
      throw new NotFoundException({ code: "collaborator_not_found", message: "This team does not collaborate on this series." });
    }
    const collaborator = await this.requireTeam(teamId);
    const owner = series.teamId ? await this.repo.findTeam(series.teamId) : null;
    if (!(this.isLead(actor, collaborator) || (owner !== null && this.isLead(actor, owner)))) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "Only the leaders of one of the two teams can end this collaboration." });
    }
    await this.repo.removeCollaborator(seriesId, teamId);
    this.catalog.invalidate();
    if (owner) await this.activity.record(owner.id, "collaborator_removed", { actorId: actor.id, detail: collaborator.name });
    await this.activity.record(collaborator.id, "collaboration_ended", { actorId: actor.id, detail: series.titleAr });
  }

  // ---- helpers ---------------------------------------------------------------

  /** A team's leaders: the site's team managers, the team's leader, and members with a lead role. */
  private isLead(actor: Actor, team: TeamRow): boolean {
    return TEAM_MANAGER_ROLES.has(actor.role) || team.leaderId === actor.id || team.members.some((m) => m.userId === actor.id && TEAM_LEAD_ROLES.has(m.role));
  }

  /** Tells the team's leaders; a team with nobody in charge (imported from the old site) tells the owners so none is lost. */
  private async tellLeaders(team: TeamRow, title: string, body: string, link: string, refId: string) {
    const leaders = new Set<string>();
    if (team.leaderId) leaders.add(team.leaderId);
    for (const m of team.members) if (TEAM_LEAD_ROLES.has(m.role)) leaders.add(m.userId);
    if (leaders.size === 0) for (const owner of await this.repo.findOwners()) leaders.add(owner.id);
    await Promise.all([...leaders].slice(0, LEADERS_TOLD).map((id) => this.notifications.notify(id, "team", title, body, link, refId)));
  }

  private async requireActor(actorId: string) {
    const actor = await this.repo.findActor(actorId);
    if (!actor) throw new NotFoundException({ code: "user_not_found", message: "Account no longer exists." });
    if (isEffectivelyBanned(actor)) throw new ForbiddenException({ code: "account_banned", message: "This account has been banned." });
    return actor;
  }

  private async requireTeam(teamId: string) {
    const team = await this.repo.findTeam(teamId);
    if (!team) throw new NotFoundException({ code: "team_not_found", message: "This team does not exist." });
    return team;
  }

  private async requireRequest(id: string) {
    const request = await this.repo.findRequest(id);
    if (!request) throw new NotFoundException({ code: "request_not_found", message: "This request does not exist." });
    return request;
  }
}

function answerText(status: string, teamName: string, seriesTitle: string, note: string | null): [string, string] {
  const tail = note ? ` ${note}` : "";
  switch (status) {
    case "accepted":
      return [`قبل فريق ${teamName} طلب التعاون`, `أصبح الفريق متعاونًا معكم على ${seriesTitle}.${tail}`];
    case "negotiating":
      return [`فريق ${teamName} يريد التفاوض على طلب التعاون`, note ?? `بخصوص ${seriesTitle}. تواصلوا مع قائد الفريق.`];
    default:
      return [`رفض فريق ${teamName} طلب التعاون`, note ?? `بخصوص ${seriesTitle}.`];
  }
}

function toDto(row: RequestRow) {
  return {
    id: row.id,
    fromTeam: row.fromTeam,
    toTeam: row.toTeam,
    series: row.series,
    type: row.type,
    message: row.message,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    respondedAt: row.respondedAt?.toISOString(),
  };
}
