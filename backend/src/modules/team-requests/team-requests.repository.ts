import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const REQUESTER = { id: true, username: true, displayName: true } as const;

export interface NewTeamRequest {
  requesterId: string;
  teamName: string;
  description: string;
  goals: string;
  discordUrl: string | null;
  requiredPositions: string[];
  category: string;
  expectedMembers: number;
  previousExperience: string;
  portfolioUrl: string | null;
  logoUrl: string | null;
  color: string | null;
}

@Injectable()
export class TeamRequestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActor(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true, username: true, displayName: true, isBanned: true, bannedUntil: true, mutedUntil: true } });
  }

  /** The accounts that decide on team requests (and so are told about a new one). */
  findManagers(roles: string[], take: number) {
    return this.prisma.user.findMany({ where: { role: { in: roles }, isBanned: false }, select: { id: true }, take });
  }

  findById(id: string) {
    return this.prisma.teamRequest.findUnique({ where: { id }, include: { requester: { select: REQUESTER } } });
  }

  listMine(userId: string) {
    return this.prisma.teamRequest.findMany({ where: { requesterId: userId }, orderBy: { createdAt: "desc" }, take: 50, include: { requester: { select: REQUESTER } } });
  }

  listAll(status: string | undefined) {
    return this.prisma.teamRequest.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { requester: { select: REQUESTER } },
    });
  }

  /** Requests still waiting on somebody: the manager's decision, or the requester's changes. */
  countOpen(userId: string) {
    return this.prisma.teamRequest.count({ where: { requesterId: userId, status: { in: ["pending", "needs_modification"] } } });
  }

  countSince(userId: string, since: Date) {
    return this.prisma.teamRequest.count({ where: { requesterId: userId, createdAt: { gte: since } } });
  }

  teamNameTaken(name: string) {
    return this.prisma.team.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } }).then((row) => row !== null);
  }

  create(data: NewTeamRequest) {
    return this.prisma.teamRequest.create({ data, include: { requester: { select: REQUESTER } } });
  }

  /** The requester's edits after being asked to change it: back to waiting for a decision. */
  resubmit(id: string, data: Omit<NewTeamRequest, "requesterId">) {
    return this.prisma.teamRequest.update({
      where: { id },
      data: { ...data, status: "pending", reviewerNote: null, reviewedById: null, reviewedAt: null },
      include: { requester: { select: REQUESTER } },
    });
  }

  decide(id: string, data: { status: string; note: string | null; reviewedById: string; createdTeamId: string | null }) {
    return this.prisma.teamRequest.update({
      where: { id },
      data: { status: data.status, reviewerNote: data.note, reviewedById: data.reviewedById, reviewedAt: new Date(), createdTeamId: data.createdTeamId },
      include: { requester: { select: REQUESTER } },
    });
  }

  /** An approved team starts recruiting for the roles its request asked for. */
  openPositions(teamId: string, roles: string[]) {
    if (roles.length === 0) return Promise.resolve({ count: 0 });
    return this.prisma.recruitmentPosition.createMany({ data: roles.map((role) => ({ teamId, role })) });
  }

  writeAuditLog(params: { actorId?: string; action: string; target?: string; ip?: string }) {
    return this.prisma.auditLog.create({ data: params });
  }
}
