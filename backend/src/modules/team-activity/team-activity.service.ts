import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { TEAM_LEAD_ROLES, TEAM_MANAGER_ROLES } from "../catalog/catalog.util";
import { isEffectivelyBanned } from "../moderation/moderation.util";
import { TeamActivityRepository } from "./team-activity.repository";
import { describeActivity, type TeamActivityAction } from "./team-activity.text";

const LIST_LIMIT = 200;
/** What stands in for an account that is gone. An action with no person behind it (the site's own) names nobody. */
const FORMER_MEMBER = "عضو سابق";

export interface ActivityDetails {
  /** Who did it; leave out when the site did. */
  actorId?: string | null;
  /** The account it was about. */
  subjectId?: string | null;
  /** A role, a team's name, a chapter number ... */
  detail?: string | null;
}

/**
 * A team's activity log: what its leaders can look back on. Other modules call {@link record} when something happens in a
 * team; a team's leaders (and the site's team managers) read it through {@link list}.
 */
@Injectable()
export class TeamActivityService {
  private readonly log = new Logger(TeamActivityService.name);

  constructor(private readonly repo: TeamActivityRepository) {}

  /** Never throws: a hiccup in the log must not undo the thing it describes. */
  async record(teamId: string | null | undefined, action: TeamActivityAction, details: ActivityDetails = {}): Promise<void> {
    if (!teamId) return;
    try {
      await this.repo.create({ teamId, action, actorId: details.actorId ?? null, subjectId: details.subjectId ?? null, detail: details.detail ?? null });
    } catch (error) {
      this.log.warn(`could not record ${action} for team ${teamId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async list(actorId: string, teamId: string) {
    const [actor, team] = await Promise.all([this.repo.findActor(actorId), this.repo.findTeam(teamId)]);
    if (!actor || isEffectivelyBanned(actor)) throw new ForbiddenException({ code: "account_banned", message: "This account cannot do this." });
    if (!team) throw new NotFoundException({ code: "team_not_found", message: "This team does not exist." });
    const lead = TEAM_MANAGER_ROLES.has(actor.role) || team.leaderId === actorId || team.members.some((m) => m.userId === actorId && TEAM_LEAD_ROLES.has(m.role));
    if (!lead) throw new ForbiddenException({ code: "insufficient_permissions", message: "Only this team's leaders can read its activity." });

    const rows = await this.repo.list(teamId, LIST_LIMIT);
    const ids = [...new Set(rows.flatMap((r) => [r.actorId, r.subjectId]).filter((id): id is string => !!id))];
    const names = new Map((await this.repo.names(ids)).map((u) => [u.id, u.displayName ?? u.username]));

    const items = rows.flatMap((row) => {
      const text = describeActivity(row.action, {
        actor: row.actorId ? names.get(row.actorId) ?? FORMER_MEMBER : null,
        subject: row.subjectId ? names.get(row.subjectId) ?? FORMER_MEMBER : "",
        detail: row.detail,
      });
      return text ? [{ id: row.id, text, at: row.at.toISOString() }] : [];
    });
    return { items };
  }
}
