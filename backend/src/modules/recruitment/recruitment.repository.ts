import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const APPLICANT = { id: true, username: true, displayName: true, avatarMimeType: true, updatedAt: true } as const;

@Injectable()
export class RecruitmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActor(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true, username: true, displayName: true, isBanned: true, bannedUntil: true, mutedUntil: true } });
  }

  /** The site's owner accounts: who hears about a team's applications when the team has no leader yet (a team imported from the old site). */
  findOwners() {
    return this.prisma.user.findMany({ where: { role: "owner", isBanned: false }, select: { id: true }, take: 5 });
  }

  /** The team with the people who run it and everyone on it. */
  findTeam(id: string) {
    return this.prisma.team.findUnique({
      where: { id },
      select: { id: true, slug: true, name: true, status: true, leaderId: true, recruiting: true, members: { select: { userId: true, role: true } } },
    });
  }

  // ---- positions -----------------------------------------------------------

  listPositions(teamId: string, includeClosed: boolean) {
    return this.prisma.recruitmentPosition.findMany({
      where: { teamId, ...(includeClosed ? {} : { isOpen: true }) },
      orderBy: { createdAt: "desc" },
    });
  }

  createPosition(data: { teamId: string; role: string; description: string }) {
    return this.prisma.recruitmentPosition.create({ data });
  }

  findPosition(id: string) {
    return this.prisma.recruitmentPosition.findUnique({ where: { id } });
  }

  setPositionOpen(id: string, isOpen: boolean) {
    return this.prisma.recruitmentPosition.update({ where: { id }, data: { isOpen } });
  }

  deletePosition(id: string) {
    return this.prisma.recruitmentPosition.delete({ where: { id } });
  }

  countOpenPositions(teamId: string) {
    return this.prisma.recruitmentPosition.count({ where: { teamId, isOpen: true } });
  }

  setTeamRecruiting(teamId: string, recruiting: boolean) {
    return this.prisma.team.update({ where: { id: teamId }, data: { recruiting } });
  }

  // ---- applications --------------------------------------------------------

  createApplication(data: {
    teamId: string;
    positionId: string | null;
    userId: string;
    preferredRole: string;
    experience: string;
    portfolioUrl: string | null;
    languages: string[];
    availability: string;
  }) {
    return this.prisma.recruitmentApplication.create({ data });
  }

  /** An application of this member to this team that has not been decided yet. */
  findOpenApplication(userId: string, teamId: string) {
    return this.prisma.recruitmentApplication.findFirst({ where: { userId, teamId, status: { in: ["pending", "interview", "waitlist"] } }, select: { id: true } });
  }

  countApplicationsSince(userId: string, since: Date) {
    return this.prisma.recruitmentApplication.count({ where: { userId, createdAt: { gte: since } } });
  }

  findApplication(id: string) {
    return this.prisma.recruitmentApplication.findUnique({ where: { id } });
  }

  listForTeam(teamId: string) {
    return this.prisma.recruitmentApplication.findMany({
      where: { teamId },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: APPLICANT } },
    });
  }

  listForUser(userId: string) {
    return this.prisma.recruitmentApplication.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { team: { select: { id: true, name: true, slug: true } } },
    });
  }

  decide(id: string, data: { status: string; note: string | null; reviewedById: string }) {
    return this.prisma.recruitmentApplication.update({ where: { id }, data: { ...data, reviewedAt: new Date() } });
  }

  deleteApplication(id: string) {
    return this.prisma.recruitmentApplication.delete({ where: { id } });
  }

  addMember(teamId: string, userId: string, role: string) {
    return this.prisma.teamMember.upsert({ where: { teamId_userId: { teamId, userId } }, update: { role }, create: { teamId, userId, role } });
  }

  writeAuditLog(params: { actorId?: string; action: string; target?: string; ip?: string }) {
    return this.prisma.auditLog.create({ data: params });
  }
}
