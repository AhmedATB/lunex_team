import { BadRequestException, ConflictException, ForbiddenException, HttpException, NotFoundException } from "@nestjs/common";
import sharp from "sharp";
import type { RequestContext } from "../../common/middleware/request-context.middleware";
import type { CatalogRepository } from "../catalog/catalog.repository";
import type { CatalogService } from "../catalog/catalog.service";
import type { StorageService } from "../images/storage/storage.interface";
import type { NotificationsService } from "../notifications/notifications.service";
import type { TeamActivityService } from "../team-activity/team-activity.service";
import type { TeamRequestDto } from "./dto/team-request.dto";
import type { TeamRequestsRepository } from "./team-requests.repository";
import { TeamRequestsService } from "./team-requests.service";

const CTX = { ip: "203.0.113.5" } as RequestContext;

const DTO: TeamRequestDto = {
  teamName: "  Crescent Ink ",
  description: "فريق ترجمة",
  goals: "نشر أسبوعي",
  requiredPositions: ["translator", "editor"],
  category: "manhwa",
  expectedMembers: 8,
  previousExperience: " سنتان ",
  discordUrl: "https://discord.gg/abc",
};

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "r1",
    requesterId: "alice",
    requester: { id: "alice", username: "alice", displayName: null },
    teamName: "Crescent Ink",
    description: "فريق ترجمة",
    goals: "نشر أسبوعي",
    discordUrl: "https://discord.gg/abc",
    requiredPositions: ["translator", "editor"],
    category: "manhwa",
    expectedMembers: 8,
    previousExperience: "",
    portfolioUrl: null,
    logo: null,
    color: "#A855F7",
    status: "pending",
    reviewerNote: null,
    reviewedById: null,
    reviewedAt: null,
    createdTeamId: null,
    createdAt: new Date("2026-09-26T10:00:00Z"),
    updatedAt: new Date("2026-09-26T10:00:00Z"),
    ...overrides,
  };
}

function build(options: { logoBytes?: Buffer; request?: Record<string, unknown> | null; openCount?: number; todayCount?: number; nameTaken?: boolean; actors?: Record<string, { role: string; isBanned?: boolean }> } = {}) {
  const actors = { alice: { role: "reader" }, boss: { role: "owner" }, mod: { role: "moderator" }, ...(options.actors ?? {}) };
  const repo = {
    findActor: jest.fn(async (id: string) => {
      const a = actors[id as keyof typeof actors] as { role: string; isBanned?: boolean } | undefined;
      return a ? { id, username: id, displayName: null, role: a.role, isBanned: a.isBanned ?? false, bannedUntil: null, mutedUntil: null } : null;
    }),
    findManagers: jest.fn(async () => [{ id: "boss" }, { id: "alice" }]),
    findById: jest.fn(async () => (options.request === null ? null : row(options.request ?? {}))),
    listMine: jest.fn(async () => [row()]),
    listAll: jest.fn(async () => [row()]),
    countOpen: jest.fn(async () => options.openCount ?? 0),
    countSince: jest.fn(async () => options.todayCount ?? 0),
    teamNameTaken: jest.fn(async () => options.nameTaken ?? false),
    create: jest.fn(async (data: Record<string, unknown>) => row(data)),
    resubmit: jest.fn(async (_id: string, data: Record<string, unknown>) => row({ ...data, status: "pending" })),
    decide: jest.fn(async (_id: string, d: { status: string; note: string | null; reviewedById: string; createdTeamId: string | null }) =>
      row({ status: d.status, reviewerNote: d.note, reviewedById: d.reviewedById, createdTeamId: d.createdTeamId, reviewedAt: new Date("2026-09-27T00:00:00Z") })
    ),
    openPositions: jest.fn(async () => ({ count: 2 })),
    setLogo: jest.fn(async () => ({})),
    removeLogo: jest.fn(async () => ({ count: 1 })),
    findLogo: jest.fn(async () => (options.logoBytes ? { requestId: "r1", data: options.logoBytes, mimeType: "image/webp", updatedAt: new Date() } : null)),
    writeAuditLog: jest.fn(async () => ({})),
  };
  const catalogRepo = {
    teamSlugTaken: jest.fn(async () => false),
    createTeam: jest.fn(async (data: { slug: string }) => ({ id: "team-1", slug: data.slug })),
    updateTeam: jest.fn(async () => ({})),
    findTeamById: jest.fn(async () => ({ id: "team-1", slug: "crescent-ink" })),
    createAsset: jest.fn(async () => ({ id: "asset-1" })),
  };
  const storage = { put: jest.fn(async () => ({ checksum: "abc" })) };
  const catalog = { invalidate: jest.fn() };
  const notifications = { notify: jest.fn(async () => undefined) };
  const activity = { record: jest.fn(async () => undefined) };
  const service = new TeamRequestsService(
    repo as unknown as TeamRequestsRepository,
    catalog as unknown as CatalogService,
    catalogRepo as unknown as CatalogRepository,
    notifications as unknown as NotificationsService,
    activity as unknown as TeamActivityService,
    storage as unknown as StorageService
  );
  return { service, repo, catalogRepo, catalog, notifications, activity, storage };
}

describe("sending a request", () => {
  it("saves it trimmed and tells the managers — but not the person who sent it", async () => {
    const { service, repo, notifications } = build();
    const result = await service.create("alice", DTO);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ requesterId: "alice", teamName: "Crescent Ink", previousExperience: "سنتان", portfolioUrl: null }));
    expect(result).toMatchObject({ status: "pending", requester: { username: "alice" } });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith("boss", "team", expect.stringContaining("Crescent Ink"), expect.any(String), "/admin/team-requests", "r1");
  });

  it("limits how many wait at once and how many are sent in a day, and refuses a name a team already has", async () => {
    await expect(build({ openCount: 2 }).service.create("alice", DTO)).rejects.toMatchObject({ response: { code: "too_many_open_requests" } });
    const day = await build({ todayCount: 3 }).service.create("alice", DTO).catch((e) => e);
    expect(day).toBeInstanceOf(HttpException);
    expect(day.getStatus()).toBe(429);
    await expect(build({ nameTaken: true }).service.create("alice", DTO)).rejects.toMatchObject({ response: { code: "team_name_taken" } });
  });

  it("is not for a banned account, and a blank name or text is refused", async () => {
    await expect(build({ actors: { alice: { role: "reader", isBanned: true } } }).service.create("alice", DTO)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(build().service.create("alice", { ...DTO, description: "   " })).rejects.toMatchObject({ response: { code: "invalid_request" } });
  });
});

describe("who sees the requests", () => {
  it("a member sees their own; only team managers see all", async () => {
    const { service } = build();
    await expect(service.mine("alice")).resolves.toMatchObject({ items: [{ id: "r1" }] });
    await expect(service.list("alice", undefined)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.list("mod", undefined)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.list("boss", "pending")).resolves.toMatchObject({ items: [{ id: "r1" }] });
  });
});

describe("deciding on a request", () => {
  it("approving creates the team with the requester as leader and the wanted roles open, and tells them", async () => {
    const { service, catalogRepo, repo, notifications, catalog } = build();
    const result = await service.review("boss", "r1", { status: "approved", note: "أهلًا بكم" }, CTX);
    expect(catalogRepo.createTeam).toHaveBeenCalledWith(expect.objectContaining({ name: "Crescent Ink", leaderId: "alice", recruiting: true, status: "active", category: "manhwa", color: "#A855F7", slug: "crescent-ink" }));
    expect(repo.openPositions).toHaveBeenCalledWith("team-1", ["translator", "editor"]);
    expect(repo.decide).toHaveBeenCalledWith("r1", { status: "approved", note: "أهلًا بكم", reviewedById: "boss", createdTeamId: "team-1" });
    expect(repo.writeAuditLog).toHaveBeenCalledWith({ actorId: "boss", action: "team_request.approved", target: "r1", ip: "203.0.113.5" });
    expect(notifications.notify).toHaveBeenCalledWith("alice", "team", expect.stringContaining("Crescent Ink"), expect.stringContaining("أهلًا بكم"), "/teams/crescent-ink", "team-1");
    expect(catalog.invalidate).toHaveBeenCalled();
    expect(result).toMatchObject({ status: "approved", createdTeamId: "team-1" });
  });

  it("writes the new team's first entry — and later status changes — to its activity log", async () => {
    const approved = build();
    await approved.service.review("boss", "r1", { status: "approved" }, CTX);
    expect(approved.activity.record).toHaveBeenCalledWith("team-1", "team_created", { actorId: "boss" });
    const suspended = build({ request: { status: "approved", createdTeamId: "team-1" } });
    await suspended.service.review("boss", "r1", { status: "suspended" }, CTX);
    expect(suspended.activity.record).toHaveBeenCalledWith("team-1", "team_status_changed", { actorId: "boss", detail: "suspended" });
  });

  it("does not approve when the name was taken in the meantime", async () => {
    const { service, catalogRepo } = build({ nameTaken: true });
    await expect(service.review("boss", "r1", { status: "approved" }, CTX)).rejects.toMatchObject({ response: { code: "team_name_taken" } });
    expect(catalogRepo.createTeam).not.toHaveBeenCalled();
  });

  it("rejecting or asking for changes creates nothing and says how to continue", async () => {
    const rejected = build();
    await rejected.service.review("boss", "r1", { status: "rejected", note: "الاسم مكرر" }, CTX);
    expect(rejected.catalogRepo.createTeam).not.toHaveBeenCalled();
    expect(rejected.notifications.notify).toHaveBeenCalledWith("alice", "team", expect.any(String), "الاسم مكرر", "/teams/create", "r1");

    const changes = build();
    await changes.service.review("boss", "r1", { status: "needs_modification" }, CTX);
    expect(changes.notifications.notify).toHaveBeenCalledWith("alice", "team", expect.any(String), expect.any(String), "/teams/create?edit=r1", "r1");
  });

  it("suspending or archiving an approved request does the same to its team, and a suspended one can come back", async () => {
    const suspended = build({ request: { status: "approved", createdTeamId: "team-1" } });
    await suspended.service.review("boss", "r1", { status: "suspended" }, CTX);
    expect(suspended.catalogRepo.updateTeam).toHaveBeenCalledWith("team-1", { status: "suspended" });

    const back = build({ request: { status: "suspended", createdTeamId: "team-1" } });
    await back.service.review("boss", "r1", { status: "approved" }, CTX);
    expect(back.catalogRepo.updateTeam).toHaveBeenCalledWith("team-1", { status: "active" });
    expect(back.catalogRepo.createTeam).not.toHaveBeenCalled(); // reactivated, not created again
  });

  it("only allows the moves that make sense, and only for managers", async () => {
    await expect(build({ request: { status: "rejected" } }).service.review("boss", "r1", { status: "approved" }, CTX)).rejects.toMatchObject({ response: { code: "invalid_transition" } });
    await expect(build({ request: { status: "pending" } }).service.review("boss", "r1", { status: "suspended" }, CTX)).rejects.toBeInstanceOf(ConflictException);
    await expect(build().service.review("alice", "r1", { status: "approved" }, CTX)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(build({ request: null }).service.review("boss", "gone", { status: "approved" }, CTX)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("changing a request that was sent back", () => {
  it("puts it back to waiting and tells the managers", async () => {
    const { service, repo, notifications } = build({ request: { status: "needs_modification" } });
    await service.resubmit("alice", "r1", DTO);
    expect(repo.resubmit).toHaveBeenCalledWith("r1", expect.objectContaining({ teamName: "Crescent Ink" }));
    expect(notifications.notify).toHaveBeenCalledWith("boss", "team", expect.any(String), expect.any(String), "/admin/team-requests", "r1");
  });

  it("only its own requester, and only while changes are wanted", async () => {
    await expect(build({ request: { status: "pending" } }).service.resubmit("alice", "r1", DTO)).rejects.toMatchObject({ response: { code: "not_awaiting_changes" } });
    await expect(build({ request: { status: "needs_modification", requesterId: "bob" } }).service.resubmit("alice", "r1", DTO)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("the logo, chosen from the requester's device", () => {
  const picture = (type = "image/png") => sharp({ create: { width: 40, height: 20, channels: 3, background: "#a855f7" } }).png().toBuffer().then((buffer) => ({ buffer, mimetype: type }) as Express.Multer.File);

  it("is cropped to a small square WebP and kept with the request", async () => {
    const { service, repo } = build();
    await service.setLogo("alice", "r1", await picture());
    const [id, data, mimeType] = repo.setLogo.mock.calls[0] as unknown as [string, Buffer, string];
    expect(id).toBe("r1");
    expect(mimeType).toBe("image/webp");
    expect(await sharp(data).metadata()).toMatchObject({ format: "webp", width: 256, height: 256 });
  });

  it("is only for the requester, and only while the request can still change", async () => {
    await expect(build().service.setLogo("boss", "r1", await picture())).rejects.toBeInstanceOf(NotFoundException);
    await expect(build({ request: { status: "approved" } }).service.setLogo("alice", "r1", await picture())).rejects.toMatchObject({ response: { code: "request_not_editable" } });
    await expect(build({ request: { status: "needs_modification" } }).service.setLogo("alice", "r1", await picture())).resolves.toBeDefined();
  });

  it("refuses no file, a file that is not a picture, and bytes that cannot be read as one", async () => {
    const { service, repo } = build();
    await expect(service.setLogo("alice", "r1", undefined)).rejects.toMatchObject({ response: { code: "missing_file" } });
    await expect(service.setLogo("alice", "r1", { buffer: Buffer.from("x"), mimetype: "application/pdf" } as Express.Multer.File)).rejects.toMatchObject({ response: { code: "unsupported_image_type" } });
    await expect(service.setLogo("alice", "r1", { buffer: Buffer.from("not an image"), mimetype: "image/png" } as Express.Multer.File)).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.setLogo).not.toHaveBeenCalled();
  });

  it("can be taken off again by the requester", async () => {
    const { service, repo } = build();
    await service.removeLogo("alice", "r1");
    expect(repo.removeLogo).toHaveBeenCalledWith("r1");
    await expect(build().service.removeLogo("boss", "r1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("is shown to the requester and the managers only", async () => {
    const bytes = Buffer.from("webp-bytes");
    await expect(build({ logoBytes: bytes }).service.logoImage("alice", "r1")).resolves.toMatchObject({ mimeType: "image/webp" });
    await expect(build({ logoBytes: bytes }).service.logoImage("boss", "r1")).resolves.toMatchObject({ mimeType: "image/webp" });
    await expect(build({ logoBytes: bytes, actors: { eve: { role: "reader" } } }).service.logoImage("eve", "r1")).rejects.toBeInstanceOf(NotFoundException);
    await expect(build().service.logoImage("alice", "r1")).rejects.toMatchObject({ response: { code: "image_not_found" } });
  });

  it("shows up on the request as an address of the site's own, with a version stamp", async () => {
    const at = new Date("2026-09-27T00:00:00Z");
    const { service } = build({ request: { logo: { updatedAt: at } } });
    expect(await service.setLogo("alice", "r1", await picture())).toMatchObject({ logoUrl: `/api/team-requests/r1/logo?v=${at.getTime()}` });
    expect((await build().service.mine("alice")).items[0].logoUrl).toBeUndefined();
  });

  it("becomes the new team's logo when the request is approved — and an approval never fails because of it", async () => {
    const { service, storage, catalogRepo } = build({ logoBytes: Buffer.from("webp-bytes") });
    await service.review("boss", "r1", { status: "approved" }, CTX);
    expect(storage.put).toHaveBeenCalledWith(expect.stringMatching(/^catalog\/.+\.webp$/), expect.any(Buffer));
    expect(catalogRepo.createAsset).toHaveBeenCalledWith(expect.objectContaining({ mimeType: "image/webp", width: 256, height: 256 }));
    expect(catalogRepo.updateTeam).toHaveBeenCalledWith("team-1", { logoAssetId: "asset-1" });

    const without = build();
    await without.service.review("boss", "r1", { status: "approved" }, CTX);
    expect(without.storage.put).not.toHaveBeenCalled();

    const broken = build({ logoBytes: Buffer.from("webp-bytes") });
    broken.storage.put.mockRejectedValueOnce(new Error("disk full"));
    await expect(broken.service.review("boss", "r1", { status: "approved" }, CTX)).resolves.toMatchObject({ status: "approved" });
  });
});
