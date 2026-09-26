import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import type { RequestContext } from "../../common/middleware/request-context.middleware";
import { CatalogService } from "../catalog/catalog.service";
import { TEAM_LEAD_ROLES, TEAM_MANAGER_ROLES } from "../catalog/catalog.util";
import { isEffectivelyBanned } from "../moderation/moderation.util";
import { NotificationsService } from "../notifications/notifications.service";
import type { ApplyDto, CreatePositionDto, ReviewApplicationDto } from "./dto/recruitment.dto";
import { RecruitmentRepository } from "./recruitment.repository";

const MAX_OPEN_POSITIONS = 20;
const APPLICATIONS_PER_DAY = 5;
const DAY_MS = 86_400_000;
const UNDECIDED = new Set(["pending", "interview", "waitlist"]);

const ROLE_AR: Record<string, string> = {
  translator: "مترجم",
  editor: "محرر",
  proofreader: "مدقق لغوي",
  qc: "مراقب جودة",
  publisher: "ناشر",
  uploader: "رافع",
  recruiter: "مسؤول توظيف",
  reviewer: "مراجع",
};
const roleName = (role: string) => ROLE_AR[role] ?? role;

type TeamRow = NonNullable<Awaited<ReturnType<RecruitmentRepository["findTeam"]>>>;

interface ApplicantRow {
  id: string;
  username: string;
  displayName: string | null;
  avatarMimeType: string | null;
  updatedAt: Date;
}

/**
 * Teams recruit through the site: a team opens positions (which is what makes it show as "recruiting"), members apply, the
 * team's leaders review, and accepting puts the applicant on the team. Who may do what is decided here against the
 * account's current role and the team's own roster, never against anything the browser sends.
 */
@Injectable()
export class RecruitmentService {
  constructor(
    private readonly repo: RecruitmentRepository,
    private readonly catalog: CatalogService,
    private readonly notifications: NotificationsService
  ) {}

  // ---- positions -------------------------------------------------------------

  /** Open positions are public (the team page shows them); a team's leaders may ask for the closed ones too. */
  async listPositions(teamId: string, actorId: string | undefined, all: boolean) {
    const team = await this.requireTeam(teamId);
    const includeClosed = all && actorId !== undefined && (await this.isLead(actorId, team));
    return (await this.repo.listPositions(teamId, includeClosed)).map(toPositionDto);
  }

  async createPosition(actorId: string, teamId: string, dto: CreatePositionDto) {
    const { team } = await this.requireLead(actorId, teamId);
    if ((await this.repo.listPositions(teamId, false)).length >= MAX_OPEN_POSITIONS) {
      throw new BadRequestException({ code: "too_many_positions", message: `A team can have at most ${MAX_OPEN_POSITIONS} open positions.` });
    }
    const position = await this.repo.createPosition({ teamId, role: dto.role, description: dto.description?.trim() ?? "" });
    await this.syncRecruiting(team);
    return toPositionDto(position);
  }

  async setPositionOpen(actorId: string, positionId: string, isOpen: boolean) {
    const position = await this.requirePosition(positionId);
    const { team } = await this.requireLead(actorId, position.teamId);
    const updated = await this.repo.setPositionOpen(positionId, isOpen);
    await this.syncRecruiting(team);
    return toPositionDto(updated);
  }

  async deletePosition(actorId: string, positionId: string): Promise<void> {
    const position = await this.requirePosition(positionId);
    const { team } = await this.requireLead(actorId, position.teamId);
    await this.repo.deletePosition(positionId);
    await this.syncRecruiting(team);
  }

  // ---- applications ----------------------------------------------------------

  async apply(actorId: string, teamId: string, dto: ApplyDto) {
    const actor = await this.requireActor(actorId);
    const team = await this.requireTeam(teamId);
    if (team.status !== "active") throw new BadRequestException({ code: "team_not_active", message: "This team is not taking applications." });
    if (this.isMember(team, actorId)) throw new ConflictException({ code: "already_member", message: "You are already on this team." });

    let role = dto.preferredRole;
    let positionId: string | null = null;
    if (dto.positionId) {
      const position = await this.repo.findPosition(dto.positionId);
      if (!position || position.teamId !== teamId || !position.isOpen) {
        throw new BadRequestException({ code: "position_closed", message: "This position is closed." });
      }
      role = position.role;
      positionId = position.id;
    } else if (!team.recruiting) {
      throw new BadRequestException({ code: "not_recruiting", message: "This team is not recruiting right now." });
    }

    if (await this.repo.findOpenApplication(actorId, teamId)) {
      throw new ConflictException({ code: "already_applied", message: "You already have an application waiting with this team." });
    }
    if ((await this.repo.countApplicationsSince(actorId, new Date(Date.now() - DAY_MS))) >= APPLICATIONS_PER_DAY) {
      throw new HttpException({ code: "too_many_applications", message: "You have sent several applications today. Try again tomorrow." }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const application = await this.repo.createApplication({
      teamId,
      positionId,
      userId: actorId,
      preferredRole: role,
      experience: dto.experience.trim(),
      portfolioUrl: dto.portfolioUrl?.trim() || null,
      languages: dto.languages.map((l) => l.trim()).filter(Boolean),
      availability: dto.availability.trim(),
    });

    const name = actor.displayName ?? actor.username;
    const leaders = new Set([...(team.leaderId ? [team.leaderId] : []), ...team.members.filter((m) => TEAM_LEAD_ROLES.has(m.role)).map((m) => m.userId)]);
    // A team with nobody in charge yet (imported from the old site) has its applications go to the site's owner, so none is lost.
    if (leaders.size === 0) for (const owner of await this.repo.findOwners()) leaders.add(owner.id);
    await Promise.all(
      [...leaders].map((leaderId) =>
        this.notifications.notify(leaderId, "team", `طلب انضمام جديد إلى ${team.name}`, `${name} يتقدّم لوظيفة ${roleName(role)}.`, `/teams/${team.slug}/dashboard`, team.id)
      )
    );
    return toApplicationDto(application);
  }

  async myApplications(actorId: string) {
    const rows = await this.repo.listForUser(actorId);
    return { items: rows.map((row) => ({ ...toApplicationDto(row), team: row.team })) };
  }

  async teamApplications(actorId: string, teamId: string) {
    await this.requireLead(actorId, teamId);
    const rows = await this.repo.listForTeam(teamId);
    return { items: rows.map((row) => ({ ...toApplicationDto(row), applicant: toApplicant(row.user) })) };
  }

  async review(actorId: string, applicationId: string, dto: ReviewApplicationDto, ctx: RequestContext) {
    const application = await this.repo.findApplication(applicationId);
    if (!application) throw new NotFoundException({ code: "application_not_found", message: "This application does not exist." });
    const { actor, team } = await this.requireLead(actorId, application.teamId);
    if (!UNDECIDED.has(application.status)) {
      throw new ConflictException({ code: "already_decided", message: "This application has already been decided." });
    }

    const note = dto.note?.trim() || null;
    const role = dto.role ?? application.preferredRole;
    if (dto.status === "accepted") {
      await this.repo.addMember(team.id, application.userId, role);
      this.catalog.invalidate();
    }
    const updated = await this.repo.decide(applicationId, { status: dto.status, note, reviewedById: actor.id });
    await this.repo.writeAuditLog({ actorId: actor.id, action: `recruitment.${dto.status}`, target: `${team.id}:${application.userId}`, ip: ctx.ip });

    const [title, body] = decisionText(dto.status, team.name, role, note);
    await this.notifications.notify(application.userId, "team", title, body, `/teams/${team.slug}`, team.id);
    return toApplicationDto(updated);
  }

  /** A member takes back an application that has not been decided. */
  async withdraw(actorId: string, applicationId: string): Promise<void> {
    const application = await this.repo.findApplication(applicationId);
    if (!application || application.userId !== actorId) throw new NotFoundException({ code: "application_not_found", message: "This application does not exist." });
    if (!UNDECIDED.has(application.status)) throw new ConflictException({ code: "already_decided", message: "This application has already been decided." });
    await this.repo.deleteApplication(applicationId);
  }

  // ---- helpers ---------------------------------------------------------------

  /** A team shows as recruiting exactly while it has an open position; the badge on its page and in the teams list follows. */
  private async syncRecruiting(team: TeamRow) {
    const shouldRecruit = (await this.repo.countOpenPositions(team.id)) > 0;
    if (shouldRecruit !== team.recruiting) {
      await this.repo.setTeamRecruiting(team.id, shouldRecruit);
    }
    this.catalog.invalidate();
  }

  private isMember(team: TeamRow, userId: string) {
    return team.leaderId === userId || team.members.some((m) => m.userId === userId);
  }

  private async isLead(actorId: string, team: TeamRow): Promise<boolean> {
    const actor = await this.repo.findActor(actorId);
    if (!actor || isEffectivelyBanned(actor)) return false;
    return TEAM_MANAGER_ROLES.has(actor.role) || team.leaderId === actorId || team.members.some((m) => m.userId === actorId && TEAM_LEAD_ROLES.has(m.role));
  }

  private async requireLead(actorId: string, teamId: string) {
    const actor = await this.requireActor(actorId);
    const team = await this.requireTeam(teamId);
    if (!(await this.isLead(actorId, team))) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "Only this team's leaders can manage its recruitment." });
    }
    return { actor, team };
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

  private async requirePosition(positionId: string) {
    const position = await this.repo.findPosition(positionId);
    if (!position) throw new NotFoundException({ code: "position_not_found", message: "This position does not exist." });
    return position;
  }
}

function decisionText(status: string, teamName: string, role: string, note: string | null): [string, string] {
  const tail = note ? ` ${note}` : "";
  switch (status) {
    case "accepted":
      return [`تم قبولك في فريق ${teamName}`, `انضممت إلى الفريق بدور ${roleName(role)}.${tail}`];
    case "interview":
      return [`فريق ${teamName} يريد مقابلتك`, note ?? "سيتواصل معك قائد الفريق قريبًا."];
    case "waitlist":
      return [`طلبك في قائمة الانتظار لدى ${teamName}`, note ?? "سنخبرك حين يتوفر مكان."];
    default:
      return [`ردّ فريق ${teamName} على طلبك`, `لم يُقبل طلبك هذه المرة.${tail}`];
  }
}

function toPositionDto(row: { id: string; teamId: string; role: string; description: string; isOpen: boolean; createdAt: Date }) {
  return { id: row.id, teamId: row.teamId, role: row.role, description: row.description, isOpen: row.isOpen, createdAt: row.createdAt.toISOString() };
}

function toApplicationDto(row: {
  id: string;
  teamId: string;
  positionId: string | null;
  userId: string;
  preferredRole: string;
  experience: string;
  portfolioUrl: string | null;
  languages: string[];
  availability: string;
  status: string;
  note: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    teamId: row.teamId,
    positionId: row.positionId ?? "",
    userId: row.userId,
    preferredRole: row.preferredRole,
    experience: row.experience,
    portfolioUrl: row.portfolioUrl ?? undefined,
    languages: row.languages,
    availability: row.availability,
    status: row.status,
    note: row.note ?? undefined,
    appliedAt: row.createdAt.toISOString(),
  };
}

function toApplicant(row: ApplicantRow) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName ?? row.username,
    avatarSeed: row.id,
    avatarVersion: row.avatarMimeType ? row.updatedAt.toISOString() : null,
  };
}
