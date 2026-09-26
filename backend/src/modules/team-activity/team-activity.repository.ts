import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class TeamActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActor(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true, isBanned: true, bannedUntil: true, mutedUntil: true } });
  }

  findTeam(id: string) {
    return this.prisma.team.findUnique({ where: { id }, select: { id: true, leaderId: true, members: { select: { userId: true, role: true } } } });
  }

  create(data: { teamId: string; actorId: string | null; action: string; subjectId: string | null; detail: string | null }) {
    return this.prisma.teamActivity.create({ data, select: { id: true } });
  }

  list(teamId: string, take: number) {
    return this.prisma.teamActivity.findMany({ where: { teamId }, orderBy: { at: "desc" }, take });
  }

  /** The display names of accounts that still exist. */
  names(ids: string[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, username: true, displayName: true } });
  }
}
