import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TEAM_LEAD_ROLES } from "../catalog/catalog.util";

/**
 * What a person's place in a team lets them do with its chapters:
 * - lead: the leader, the assistant leader and the team's administrator — everything, deleting a chapter included;
 * - publisher: upload and put chapters live or take them down;
 * - uploader: upload only — the chapter stays a draft until a lead or a publisher puts it live.
 * Every other role (translator, editor, QC ...) works outside the site and has no say over what is published here.
 */
export type TeamLevel = "lead" | "publisher" | "uploader";

export interface TeamAccess {
  teamId: string;
  slug: string;
  name: string;
  level: TeamLevel;
}

export function levelOfRole(role: string): TeamLevel | null {
  if (TEAM_LEAD_ROLES.has(role)) return "lead";
  if (role === "publisher") return "publisher";
  if (role === "uploader") return "uploader";
  return null;
}

export const canPublishAt = (level: TeamLevel): boolean => level === "lead" || level === "publisher";

/** Read from the database on every call — never from the sign-in token, which would keep an old role for as long as it lives. */
@Injectable()
export class TeamAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** The active teams where the person may work on chapters, with their level in each. A suspended or archived team gives nothing. */
  async accessFor(userId: string, onlyTeamId?: string): Promise<TeamAccess[]> {
    const teams = await this.prisma.team.findMany({
      where: { ...(onlyTeamId ? { id: onlyTeamId } : {}), status: "active", OR: [{ leaderId: userId }, { members: { some: { userId } } }] },
      select: { id: true, slug: true, name: true, leaderId: true, members: { where: { userId }, select: { role: true } } },
    });
    return teams.flatMap((team) => {
      const level = team.leaderId === userId ? "lead" : levelOfRole(team.members[0]?.role ?? "");
      return level ? [{ teamId: team.id, slug: team.slug, name: team.name, level }] : [];
    });
  }

  async levelFor(userId: string, teamId: string): Promise<TeamLevel | null> {
    return (await this.accessFor(userId, teamId))[0]?.level ?? null;
  }
}
