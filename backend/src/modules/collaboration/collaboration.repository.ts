import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const TEAM = { id: true, name: true, slug: true } as const;
const WITH_PARTIES = {
  fromTeam: { select: TEAM },
  toTeam: { select: TEAM },
  series: { select: { id: true, slug: true, titleAr: true } },
} as const;

export const OPEN_STATUSES = ["pending", "negotiating"];

@Injectable()
export class CollaborationRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActor(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true, isBanned: true, bannedUntil: true, mutedUntil: true } });
  }

  /** A team with the people who run it. */
  findTeam(id: string) {
    return this.prisma.team.findUnique({ where: { id }, select: { id: true, name: true, slug: true, status: true, leaderId: true, members: { select: { userId: true, role: true } } } });
  }

  findOwners() {
    return this.prisma.user.findMany({ where: { role: "owner", isBanned: false }, select: { id: true }, take: 5 });
  }

  findSeries(id: string) {
    return this.prisma.series.findUnique({ where: { id }, select: { id: true, slug: true, titleAr: true, teamId: true } });
  }

  findRequest(id: string) {
    return this.prisma.teamCollaboration.findUnique({ where: { id }, include: WITH_PARTIES });
  }

  findOpenDuplicate(fromTeamId: string, toTeamId: string, seriesId: string, type: string) {
    return this.prisma.teamCollaboration.findFirst({ where: { fromTeamId, toTeamId, seriesId, type, status: { in: OPEN_STATUSES } }, select: { id: true } });
  }

  countOpenFrom(fromTeamId: string) {
    return this.prisma.teamCollaboration.count({ where: { fromTeamId, status: { in: OPEN_STATUSES } } });
  }

  create(data: { fromTeamId: string; toTeamId: string; seriesId: string; type: string; message: string; createdById: string }) {
    return this.prisma.teamCollaboration.create({ data, include: WITH_PARTIES });
  }

  listFor(teamId: string) {
    return this.prisma.teamCollaboration.findMany({
      where: { OR: [{ fromTeamId: teamId }, { toTeamId: teamId }] },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: WITH_PARTIES,
    });
  }

  respond(id: string, data: { status: string; respondedById: string }) {
    return this.prisma.teamCollaboration.update({ where: { id }, data: { ...data, respondedAt: new Date() }, include: WITH_PARTIES });
  }

  addCollaborator(seriesId: string, teamId: string) {
    return this.prisma.seriesCollaborator.upsert({ where: { seriesId_teamId: { seriesId, teamId } }, update: {}, create: { seriesId, teamId } });
  }

  removeCollaborator(seriesId: string, teamId: string) {
    return this.prisma.seriesCollaborator.deleteMany({ where: { seriesId, teamId } });
  }

  hasCollaborator(seriesId: string, teamId: string) {
    return this.prisma.seriesCollaborator.findUnique({ where: { seriesId_teamId: { seriesId, teamId } }, select: { teamId: true } }).then((row) => row !== null);
  }

  writeAuditLog(params: { actorId?: string; action: string; target?: string; ip?: string }) {
    return this.prisma.auditLog.create({ data: params });
  }
}
