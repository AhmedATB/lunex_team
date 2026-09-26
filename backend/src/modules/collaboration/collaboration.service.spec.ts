import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { RequestContext } from "../../common/middleware/request-context.middleware";
import type { CatalogService } from "../catalog/catalog.service";
import type { NotificationsService } from "../notifications/notifications.service";
import type { TeamActivityService } from "../team-activity/team-activity.service";
import type { CollaborationRepository } from "./collaboration.repository";
import { CollaborationService } from "./collaboration.service";

const CTX = { ip: "203.0.113.4" } as RequestContext;
const at = new Date("2026-09-26T10:00:00Z");

const TEAMS: Record<string, { id: string; name: string; slug: string; status: string; leaderId: string | null; members: { userId: string; role: string }[] }> = {
  a: { id: "a", name: "Alpha", slug: "alpha", status: "active", leaderId: "leadA", members: [{ userId: "assistA", role: "assistant_leader" }, { userId: "plainA", role: "translator" }] },
  b: { id: "b", name: "Beta", slug: "beta", status: "active", leaderId: "leadB", members: [] },
  c: { id: "c", name: "Gamma", slug: "gamma", status: "suspended", leaderId: "leadC", members: [] },
  orphan: { id: "orphan", name: "Old", slug: "old", status: "active", leaderId: null, members: [] },
};
const ROLES: Record<string, string> = { leadA: "reader", assistA: "reader", plainA: "reader", leadB: "reader", leadC: "reader", boss: "owner", stranger: "reader" };

const request = (overrides: Record<string, unknown> = {}) => ({
  id: "r1",
  fromTeamId: "a",
  toTeamId: "b",
  seriesId: "s1",
  type: "need_translator",
  message: "نحتاج مترجمًا",
  status: "pending",
  createdById: "leadA",
  respondedById: null,
  respondedAt: null,
  createdAt: at,
  fromTeam: { id: "a", name: "Alpha", slug: "alpha" },
  toTeam: { id: "b", name: "Beta", slug: "beta" },
  series: { id: "s1", slug: "rose", titleAr: "الوردة" },
  ...overrides,
});

function build(options: { req?: Record<string, unknown> | null; duplicate?: boolean; open?: number; seriesTeam?: string | null; collaborates?: boolean } = {}) {
  const repo = {
    findActor: jest.fn(async (id: string) => (ROLES[id] ? { id, role: ROLES[id], isBanned: false, bannedUntil: null, mutedUntil: null } : null)),
    findTeam: jest.fn(async (id: string) => TEAMS[id] ?? null),
    findOwners: jest.fn(async () => [{ id: "boss" }]),
    findSeries: jest.fn(async (id: string) => (id === "s1" ? { id: "s1", slug: "rose", titleAr: "الوردة", teamId: options.seriesTeam === undefined ? "a" : options.seriesTeam } : null)),
    findRequest: jest.fn(async () => (options.req === null ? null : request(options.req ?? {}))),
    findOpenDuplicate: jest.fn(async () => (options.duplicate ? { id: "r0" } : null)),
    countOpenFrom: jest.fn(async () => options.open ?? 0),
    create: jest.fn(async (d: Record<string, unknown>) => request(d)),
    listFor: jest.fn(async () => [request(), request({ id: "r2", fromTeamId: "b", toTeamId: "a" })]),
    respond: jest.fn(async (_id: string, d: { status: string }) => request({ status: d.status, respondedAt: at })),
    addCollaborator: jest.fn(async () => ({})),
    removeCollaborator: jest.fn(async () => ({ count: 1 })),
    hasCollaborator: jest.fn(async () => options.collaborates ?? true),
    writeAuditLog: jest.fn(async () => ({})),
  };
  const catalog = { invalidate: jest.fn() };
  const notifications = { notify: jest.fn(async () => undefined) };
  const activity = { record: jest.fn(async () => undefined) };
  const service = new CollaborationService(repo as unknown as CollaborationRepository, catalog as unknown as CatalogService, notifications as unknown as NotificationsService, activity as unknown as TeamActivityService);
  return { service, repo, catalog, notifications, activity };
}

const dto = { fromTeamId: "a", toTeamId: "b", seriesId: "s1", type: "need_translator", message: "  نحتاج مترجمًا " };

describe("asking another team for help", () => {
  it("saves it, tells the asked team's leaders, and writes both teams' logs", async () => {
    const { service, repo, notifications, activity } = build();
    const result = await service.create("leadA", dto);
    expect(repo.create).toHaveBeenCalledWith({ fromTeamId: "a", toTeamId: "b", seriesId: "s1", type: "need_translator", message: "نحتاج مترجمًا", createdById: "leadA" });
    expect(result).toMatchObject({ status: "pending", fromTeam: { name: "Alpha" }, toTeam: { name: "Beta" } });
    expect(notifications.notify).toHaveBeenCalledWith("leadB", "team", expect.stringContaining("Alpha"), expect.stringContaining("الوردة"), "/teams/beta/dashboard", "r1");
    expect(activity.record).toHaveBeenCalledWith("a", "collaboration_sent", { actorId: "leadA", detail: "Beta" });
    expect(activity.record).toHaveBeenCalledWith("b", "collaboration_received", { detail: "Alpha" });
  });

  it("is for the team's leaders and the site's managers; a member or a stranger cannot ask on its behalf", async () => {
    for (const who of ["leadA", "assistA", "boss"]) await expect(build().service.create(who, dto)).resolves.toMatchObject({ id: "r1" });
    for (const who of ["plainA", "stranger", "leadB"]) await expect(build().service.create(who, dto)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("only for its own series, between two different active teams", async () => {
    await expect(build({ seriesTeam: "b" }).service.create("leadA", dto)).rejects.toMatchObject({ response: { code: "not_your_series" } });
    await expect(build({ seriesTeam: null }).service.create("leadA", dto)).rejects.toMatchObject({ response: { code: "not_your_series" } });
    await expect(build().service.create("leadA", { ...dto, seriesId: "nope" })).rejects.toBeInstanceOf(NotFoundException);
    await expect(build().service.create("leadA", { ...dto, toTeamId: "a" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(build().service.create("leadA", { ...dto, toTeamId: "c" })).rejects.toMatchObject({ response: { code: "team_not_active" } });
    await expect(build().service.create("leadA", { ...dto, toTeamId: "ghost" })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("not twice while the first still waits, and not without limit", async () => {
    await expect(build({ duplicate: true }).service.create("leadA", dto)).rejects.toMatchObject({ response: { code: "duplicate_request" } });
    await expect(build({ open: 10 }).service.create("leadA", dto)).rejects.toMatchObject({ response: { code: "too_many_open_requests" } });
  });

  it("tells the owners when the asked team has nobody in charge", async () => {
    const { service, notifications } = build();
    await service.create("leadA", { ...dto, toTeamId: "orphan" });
    expect(notifications.notify).toHaveBeenCalledWith("boss", "team", expect.any(String), expect.any(String), "/teams/old/dashboard", "r1");
  });
});

describe("answering", () => {
  it("accepting makes the asked team a collaborator on the series and tells the asking team", async () => {
    const { service, repo, catalog, notifications, activity } = build();
    await service.respond("leadB", "r1", { status: "accepted", note: "بكل سرور" }, CTX);
    expect(repo.addCollaborator).toHaveBeenCalledWith("s1", "b");
    expect(catalog.invalidate).toHaveBeenCalled();
    expect(repo.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "collaboration.accepted", ip: "203.0.113.4" }));
    expect(notifications.notify).toHaveBeenCalledWith("leadA", "team", expect.stringContaining("Beta"), expect.stringContaining("بكل سرور"), "/teams/alpha/dashboard", "r1");
    expect(activity.record).toHaveBeenCalledWith("b", "collaboration_accepted", { actorId: "leadB", detail: "Alpha" });
    expect(activity.record).toHaveBeenCalledWith("a", "collaboration_accepted_by", { detail: "Beta" });
  });

  it("refusing or negotiating adds nobody", async () => {
    for (const status of ["rejected", "negotiating"]) {
      const { service, repo } = build();
      await service.respond("leadB", "r1", { status }, CTX);
      expect(repo.addCollaborator).not.toHaveBeenCalled();
    }
  });

  it("only the asked team's leaders answer, once (a negotiation can still be settled)", async () => {
    await expect(build().service.respond("leadA", "r1", { status: "accepted" }, CTX)).rejects.toBeInstanceOf(ForbiddenException); // the asker cannot answer itself
    await expect(build().service.respond("stranger", "r1", { status: "accepted" }, CTX)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(build({ req: { status: "accepted" } }).service.respond("leadB", "r1", { status: "rejected" }, CTX)).rejects.toMatchObject({ response: { code: "already_decided" } });
    await expect(build({ req: { status: "negotiating" } }).service.respond("leadB", "r1", { status: "negotiating" }, CTX)).rejects.toMatchObject({ response: { code: "already_decided" } });
    await expect(build({ req: { status: "negotiating" } }).service.respond("leadB", "r1", { status: "accepted" }, CTX)).resolves.toMatchObject({ status: "accepted" });
    await expect(build({ req: null }).service.respond("leadB", "gone", { status: "accepted" }, CTX)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("listing and ending", () => {
  it("shows a team's leaders both directions, and nobody else", async () => {
    const { service } = build();
    const result = await service.list("leadA", "a");
    expect(result.outgoing.map((r) => r.id)).toEqual(["r1"]);
    expect(result.incoming.map((r) => r.id)).toEqual(["r2"]);
    await expect(service.list("plainA", "a")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.list("boss", "a")).resolves.toHaveProperty("incoming");
  });

  it("ends a collaboration for either team's leaders, and writes it to both logs", async () => {
    for (const who of ["leadA", "leadB"]) {
      const { service, repo, catalog, activity } = build();
      await service.removeCollaborator(who, "s1", "b");
      expect(repo.removeCollaborator).toHaveBeenCalledWith("s1", "b");
      expect(catalog.invalidate).toHaveBeenCalled();
      expect(activity.record).toHaveBeenCalledWith("a", "collaborator_removed", { actorId: who, detail: "Beta" });
      expect(activity.record).toHaveBeenCalledWith("b", "collaboration_ended", { actorId: who, detail: "الوردة" });
    }
    await expect(build().service.removeCollaborator("stranger", "s1", "b")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(build({ collaborates: false }).service.removeCollaborator("leadA", "s1", "b")).rejects.toMatchObject({ response: { code: "collaborator_not_found" } });
  });
});
