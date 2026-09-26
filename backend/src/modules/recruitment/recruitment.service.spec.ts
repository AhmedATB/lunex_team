import { BadRequestException, ConflictException, ForbiddenException, HttpException, NotFoundException } from "@nestjs/common";
import type { RequestContext } from "../../common/middleware/request-context.middleware";
import type { CatalogService } from "../catalog/catalog.service";
import type { NotificationsService } from "../notifications/notifications.service";
import type { RecruitmentRepository } from "./recruitment.repository";
import { RecruitmentService } from "./recruitment.service";

const CTX = { ip: "203.0.113.9" } as RequestContext;

const team = (overrides: Record<string, unknown> = {}) => ({
  id: "t1",
  slug: "nova",
  name: "Nova",
  status: "active",
  leaderId: "leader",
  recruiting: false,
  members: [{ userId: "assistant", role: "assistant_leader" }, { userId: "member", role: "translator" }],
  ...overrides,
});

const APPLICATION = {
  id: "a1",
  teamId: "t1",
  positionId: "p1",
  userId: "applicant",
  preferredRole: "translator",
  experience: "سنتان",
  portfolioUrl: null,
  languages: ["العربية"],
  availability: "3 فصول أسبوعيًا",
  status: "pending",
  note: null,
  createdAt: new Date("2026-09-25T10:00:00Z"),
};

const roles: Record<string, string> = { owner: "owner", manager: "global_team_manager", leader: "reader", assistant: "reader", member: "reader", applicant: "reader", editor: "editor", banned: "reader" };

function build(overrides: Record<string, unknown> = {}) {
  const repo = {
    findOwners: jest.fn().mockResolvedValue([{ id: "owner" }]),
    findActor: jest.fn(async (id: string) => (roles[id] ? { id, role: roles[id], username: id, displayName: `${id} name`, isBanned: id === "banned", bannedUntil: null, mutedUntil: null } : null)),
    findTeam: jest.fn(async () => team()),
    listPositions: jest.fn(async (_t: string, _closed: boolean) => [] as unknown[]),
    createPosition: jest.fn(async (d: { teamId: string; role: string; description: string }) => ({ id: "p9", isOpen: true, createdAt: new Date(), ...d })),
    findPosition: jest.fn(async () => ({ id: "p1", teamId: "t1", role: "translator", description: "", isOpen: true, createdAt: new Date() })),
    setPositionOpen: jest.fn(async (id: string, isOpen: boolean) => ({ id, teamId: "t1", role: "translator", description: "", isOpen, createdAt: new Date() })),
    deletePosition: jest.fn().mockResolvedValue(undefined),
    countOpenPositions: jest.fn().mockResolvedValue(1),
    setTeamRecruiting: jest.fn().mockResolvedValue(undefined),
    createApplication: jest.fn(async () => ({ ...APPLICATION })),
    findOpenApplication: jest.fn().mockResolvedValue(null),
    countApplicationsSince: jest.fn().mockResolvedValue(0),
    findApplication: jest.fn(async () => ({ ...APPLICATION })),
    listForTeam: jest.fn().mockResolvedValue([]),
    listForUser: jest.fn().mockResolvedValue([]),
    decide: jest.fn(async (_id: string, d: { status: string }) => ({ ...APPLICATION, status: d.status })),
    deleteApplication: jest.fn().mockResolvedValue(undefined),
    addMember: jest.fn().mockResolvedValue(undefined),
    writeAuditLog: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const catalog = { invalidate: jest.fn() };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new RecruitmentService(repo as unknown as RecruitmentRepository, catalog as unknown as CatalogService, notifications as unknown as NotificationsService);
  return { service, repo, catalog, notifications };
}

const application = { positionId: "p1", preferredRole: "translator", experience: "سنتان في الترجمة", languages: ["العربية"], availability: "3 فصول أسبوعيًا" };

describe("positions", () => {
  it("lets the team's leaders and the site's team managers open one, and turns the recruiting badge on", async () => {
    for (const who of ["leader", "assistant", "owner", "manager"]) {
      const { service, repo, catalog } = build();
      await expect(service.createPosition(who, "t1", { role: "translator", description: " ابحث عن مترجم " })).resolves.toMatchObject({ role: "translator", description: "ابحث عن مترجم", isOpen: true });
      expect(repo.setTeamRecruiting).toHaveBeenCalledWith("t1", true);
      expect(catalog.invalidate).toHaveBeenCalled();
    }
  });

  it("is not for members, editors or strangers, nor for a banned leader", async () => {
    for (const who of ["member", "editor", "applicant"]) {
      await expect(build().service.createPosition(who, "t1", { role: "translator" })).rejects.toBeInstanceOf(ForbiddenException);
    }
    await expect(build().service.createPosition("banned", "t1", { role: "translator" })).rejects.toMatchObject({ response: { code: "account_banned" } });
  });

  it("turns the badge off when the last open position is closed, and leaves it alone when nothing changed", async () => {
    const closing = build({ findTeam: jest.fn(async () => team({ recruiting: true })), countOpenPositions: jest.fn().mockResolvedValue(0) });
    await closing.service.setPositionOpen("leader", "p1", false);
    expect(closing.repo.setTeamRecruiting).toHaveBeenCalledWith("t1", false);

    const unchanged = build({ findTeam: jest.fn(async () => team({ recruiting: true })), countOpenPositions: jest.fn().mockResolvedValue(2) });
    await unchanged.service.deletePosition("leader", "p1");
    expect(unchanged.repo.setTeamRecruiting).not.toHaveBeenCalled();
  });

  it("shows open positions to anyone and closed ones only to the team's leaders", async () => {
    const { service, repo } = build();
    await service.listPositions("t1", undefined, true);
    expect(repo.listPositions).toHaveBeenLastCalledWith("t1", false);
    await service.listPositions("t1", "member", true);
    expect(repo.listPositions).toHaveBeenLastCalledWith("t1", false);
    await service.listPositions("t1", "leader", true);
    expect(repo.listPositions).toHaveBeenLastCalledWith("t1", true);
  });

  it("caps a team at twenty open positions", async () => {
    const { service } = build({ listPositions: jest.fn().mockResolvedValue(Array.from({ length: 20 }, (_, i) => ({ id: `${i}` }))) });
    await expect(service.createPosition("leader", "t1", { role: "editor" })).rejects.toMatchObject({ response: { code: "too_many_positions" } });
  });
});

describe("applying", () => {
  it("records the application under the position's own role and tells the team's leaders", async () => {
    const { service, repo, notifications } = build({ findPosition: jest.fn(async () => ({ id: "p1", teamId: "t1", role: "editor", isOpen: true })) });
    await service.apply("applicant", "t1", { ...application, preferredRole: "translator" });
    expect(repo.createApplication).toHaveBeenCalledWith(expect.objectContaining({ teamId: "t1", positionId: "p1", userId: "applicant", preferredRole: "editor" }));
    const told = notifications.notify.mock.calls.map((c) => c[0]).sort();
    expect(told).toEqual(["assistant", "leader"]);
    expect(notifications.notify).toHaveBeenCalledWith("leader", "team", "طلب انضمام جديد إلى Nova", "applicant name يتقدّم لوظيفة محرر.", "/teams/nova/dashboard", "t1");
  });

  it("sends the application to the site's owner when the team has nobody in charge", async () => {
    const { service, notifications } = build({ findTeam: jest.fn(async () => team({ leaderId: null, members: [] })) });
    await service.apply("applicant", "t1", application);
    expect(notifications.notify.mock.calls.map((c) => c[0])).toEqual(["owner"]);
  });

  it("takes a general application only from a team that is recruiting", async () => {
    const closed = build();
    await expect(closed.service.apply("applicant", "t1", { ...application, positionId: undefined })).rejects.toMatchObject({ response: { code: "not_recruiting" } });
    const open = build({ findTeam: jest.fn(async () => team({ recruiting: true })) });
    await expect(open.service.apply("applicant", "t1", { ...application, positionId: undefined })).resolves.toBeDefined();
  });

  it("refuses a closed position, a member, a team that is not active, a second application and too many in a day", async () => {
    await expect(build({ findPosition: jest.fn(async () => ({ id: "p1", teamId: "t1", role: "editor", isOpen: false })) }).service.apply("applicant", "t1", application)).rejects.toMatchObject({ response: { code: "position_closed" } });
    await expect(build({ findPosition: jest.fn(async () => ({ id: "p1", teamId: "other", role: "editor", isOpen: true })) }).service.apply("applicant", "t1", application)).rejects.toMatchObject({ response: { code: "position_closed" } });
    await expect(build().service.apply("member", "t1", application)).rejects.toBeInstanceOf(ConflictException);
    await expect(build().service.apply("leader", "t1", application)).rejects.toMatchObject({ response: { code: "already_member" } });
    await expect(build({ findTeam: jest.fn(async () => team({ status: "suspended" })) }).service.apply("applicant", "t1", application)).rejects.toBeInstanceOf(BadRequestException);
    await expect(build({ findOpenApplication: jest.fn().mockResolvedValue({ id: "x" }) }).service.apply("applicant", "t1", application)).rejects.toMatchObject({ response: { code: "already_applied" } });
    await expect(build({ countApplicationsSince: jest.fn().mockResolvedValue(5) }).service.apply("applicant", "t1", application)).rejects.toBeInstanceOf(HttpException);
  });

  it("shows the team's applications only to its leaders", async () => {
    await expect(build().service.teamApplications("leader", "t1")).resolves.toEqual({ items: [] });
    await expect(build().service.teamApplications("member", "t1")).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("reviewing", () => {
  it("accepting puts the applicant on the team in the role and tells them", async () => {
    const { service, repo, catalog, notifications } = build();
    await service.review("leader", "a1", { status: "accepted", role: "editor", note: "أهلًا بك" }, CTX);
    expect(repo.addMember).toHaveBeenCalledWith("t1", "applicant", "editor");
    expect(repo.decide).toHaveBeenCalledWith("a1", { status: "accepted", note: "أهلًا بك", reviewedById: "leader" });
    expect(catalog.invalidate).toHaveBeenCalled();
    expect(repo.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ actorId: "leader", action: "recruitment.accepted" }));
    expect(notifications.notify).toHaveBeenCalledWith("applicant", "team", "تم قبولك في فريق Nova", "انضممت إلى الفريق بدور محرر. أهلًا بك", "/teams/nova", "t1");
  });

  it("uses the role applied for when none is chosen, and does not add anyone for a refusal or an interview", async () => {
    const accepted = build();
    await accepted.service.review("assistant", "a1", { status: "accepted" }, CTX);
    expect(accepted.repo.addMember).toHaveBeenCalledWith("t1", "applicant", "translator");
    for (const status of ["rejected", "interview", "waitlist"]) {
      const { service, repo, notifications } = build();
      await service.review("leader", "a1", { status }, CTX);
      expect(repo.addMember).not.toHaveBeenCalled();
      expect(notifications.notify).toHaveBeenCalledWith("applicant", "team", expect.any(String), expect.any(String), "/teams/nova", "t1");
    }
  });

  it("is for the team's leaders, and only for an application not yet decided", async () => {
    await expect(build().service.review("member", "a1", { status: "accepted" }, CTX)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(build().service.review("applicant", "a1", { status: "accepted" }, CTX)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(build({ findApplication: jest.fn(async () => ({ ...APPLICATION, status: "accepted" })) }).service.review("leader", "a1", { status: "rejected" }, CTX)).rejects.toMatchObject({ response: { code: "already_decided" } });
    await expect(build({ findApplication: jest.fn().mockResolvedValue(null) }).service.review("leader", "zz", { status: "accepted" }, CTX)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("lets an applicant withdraw their own undecided application, nobody else's and nothing decided", async () => {
    const { service, repo } = build();
    await service.withdraw("applicant", "a1");
    expect(repo.deleteApplication).toHaveBeenCalledWith("a1");
    await expect(build().service.withdraw("member", "a1")).rejects.toBeInstanceOf(NotFoundException);
    await expect(build({ findApplication: jest.fn(async () => ({ ...APPLICATION, status: "rejected" })) }).service.withdraw("applicant", "a1")).rejects.toBeInstanceOf(ConflictException);
  });
});
