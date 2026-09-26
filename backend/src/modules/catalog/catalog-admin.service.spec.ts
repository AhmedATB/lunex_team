import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { RequestContext } from "../../common/middleware/request-context.middleware";
import type { StorageService } from "../images/storage/storage.interface";
import { CatalogAdminService } from "./catalog-admin.service";
import type { CatalogRepository } from "./catalog.repository";
import type { CatalogService } from "./catalog.service";

const CTX = { ip: "203.0.113.5" } as RequestContext;

const seriesRow = (overrides: Record<string, unknown> = {}) => ({
  id: "s1",
  slug: "s",
  titleAr: "س",
  titleEn: "S",
  alternativeTitles: [],
  synopsis: "",
  type: "manhwa",
  status: "ongoing",
  country: "kr",
  author: "",
  artist: "",
  year: null,
  contentRating: "safe",
  coverAssetId: null,
  bannerAssetId: null,
  teamId: "t1",
  isFeatured: false,
  isRecommended: false,
  viewCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  tags: [],
  ...overrides,
});

const teamRow = (overrides: Record<string, unknown> = {}) => ({
  id: "t1",
  slug: "t",
  name: "T",
  description: "",
  goals: "",
  color: "#6D28D9",
  logoHue: 270,
  logoAssetId: null,
  discordUrl: null,
  websiteUrl: null,
  category: "mixed",
  status: "active",
  recruiting: false,
  leaderId: "leader",
  createdAt: new Date(),
  updatedAt: new Date(),
  members: [],
  ...overrides,
});

function build(roles: Record<string, string>) {
  const repo = {
    findActor: jest.fn(async (id: string) => (roles[id] ? { id, role: roles[id], isBanned: false, bannedUntil: null } : null)),
    findSeriesById: jest.fn(async () => seriesRow()),
    findTeamById: jest.fn(async () => teamRow()),
    membersOfTeam: jest.fn(async () => [] as { userId: string; role: string }[]),
    seriesSlugTaken: jest.fn(async () => false),
    teamSlugTaken: jest.fn(async () => false),
    findTagsBySlugs: jest.fn(async (slugs: string[]) => slugs.filter((s) => s !== "nope").map((s) => ({ id: `id-${s}`, slug: s, nameEn: s, nameAr: s, group: "genre" }))),
    createSeries: jest.fn(async (_d: unknown) => seriesRow()),
    updateSeries: jest.fn(async (_id: string, _d: unknown, _t?: unknown) => seriesRow()),
    deleteSeriesCascade: jest.fn().mockResolvedValue([]),
    statsFor: jest.fn(async () => new Map()),
    createTeam: jest.fn(async (_d: unknown) => teamRow()),
    updateTeam: jest.fn(async (_id: string, _d: unknown) => teamRow()),
    deleteTeam: jest.fn().mockResolvedValue(undefined),
    findUserIdByUsername: jest.fn(async (u: string) => (u === "ghost" ? null : `id-${u}`)),
    findPeople: jest.fn(async (ids: string[]) => ids.map((id) => ({ id }))),
    setMember: jest.fn().mockResolvedValue(undefined),
    removeMember: jest.fn().mockResolvedValue(undefined),
    createNews: jest.fn(async (_d: unknown) => ({ id: "n1", title: "t", excerpt: "", content: "", coverAssetId: null, category: "news", authorId: "x", createdAt: new Date(), updatedAt: new Date() })),
    findNews: jest.fn(async () => ({ id: "n1" })),
    updateNews: jest.fn(async () => ({ id: "n1", title: "t", excerpt: "", content: "", coverAssetId: null, category: "news", authorId: "x", createdAt: new Date(), updatedAt: new Date() })),
    deleteNews: jest.fn().mockResolvedValue(undefined),
    createTag: jest.fn(async (d: { slug: string; nameEn: string; nameAr: string; group: string }) => ({ id: "tag1", ...d })),
    createAsset: jest.fn(async () => ({ id: "asset1" })),
    writeAuditLog: jest.fn().mockResolvedValue(undefined),
  };
  const catalog = { invalidate: jest.fn() };
  const storage = { put: jest.fn(async () => ({ checksum: "abc" })), get: jest.fn() };
  const service = new CatalogAdminService(repo as unknown as CatalogRepository, catalog as unknown as CatalogService, storage as unknown as StorageService);
  return { service, repo, catalog, storage };
}

const roster = { owner: "owner", editor: "editor", manager: "global_team_manager", newsie: "news_manager", leader: "reader", member: "reader", reader: "reader", mod: "moderator" };

describe("series permissions", () => {
  it("lets editors and above create series, and readers not", async () => {
    const { service, repo } = build(roster);
    await service.createSeries("editor", { titleAr: "س" }, CTX);
    await service.createSeries("owner", { titleAr: "س" }, CTX);
    await expect(service.createSeries("reader", { titleAr: "س" }, CTX)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.createSeries("mod", { titleAr: "س" }, CTX)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.createSeries).toHaveBeenCalledTimes(2);
  });

  it("lets a team's leader add a series to their own team but never flag it as featured", async () => {
    const { service, repo } = build(roster);
    await service.createSeries("leader", { titleAr: "س", teamId: "t1", isFeatured: true, isRecommended: true }, CTX);
    expect(repo.createSeries).toHaveBeenCalledWith(expect.objectContaining({ teamId: "t1", isFeatured: false, isRecommended: false }));
    await expect(service.createSeries("member", { titleAr: "س" }, CTX)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("recognises an assistant leader through the member table", async () => {
    const { service, repo } = build(roster);
    repo.findTeamById.mockResolvedValue(teamRow({ leaderId: "someone-else" }));
    repo.membersOfTeam.mockResolvedValue([{ userId: "member", role: "assistant_leader" }]);
    await expect(service.updateSeries("member", "s1", { synopsis: "new" }, CTX)).resolves.toBeDefined();
    repo.membersOfTeam.mockResolvedValue([{ userId: "member", role: "translator" }]);
    await expect(service.updateSeries("member", "s1", { synopsis: "new" }, CTX)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("reserves featuring, visibility and team moves for global editors", async () => {
    const { service } = build(roster);
    for (const dto of [{ isFeatured: true }, { isRecommended: true }, { state: "draft" }, { teamId: "" }]) {
      await expect(service.updateSeries("leader", "s1", dto, CTX)).rejects.toMatchObject({ response: { code: "global_editor_only" } });
    }
    await expect(service.updateSeries("editor", "s1", { isFeatured: true }, CTX)).resolves.toBeDefined();
  });

  it("only lets global editors delete", async () => {
    const { service, repo } = build(roster);
    await expect(service.deleteSeries("leader", "s1", CTX)).rejects.toBeInstanceOf(ForbiddenException);
    await service.deleteSeries("editor", "s1", CTX);
    expect(repo.deleteSeriesCascade).toHaveBeenCalledWith("s1");
  });

  it("rejects unknown tag slugs instead of dropping them", async () => {
    const { service } = build(roster);
    await expect(service.createSeries("editor", { titleAr: "س", tagSlugs: ["action", "nope"] }, CTX)).rejects.toMatchObject({ response: { code: "unknown_tags" } });
  });

  it("404s a series or team that does not exist", async () => {
    const { service, repo } = build(roster);
    repo.findSeriesById.mockResolvedValue(null as never);
    await expect(service.updateSeries("editor", "x", { synopsis: "a" }, CTX)).rejects.toBeInstanceOf(NotFoundException);
    repo.findTeamById.mockResolvedValue(null as never);
    await expect(service.createSeries("editor", { titleAr: "س", teamId: "x" }, CTX)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("makes the slug from the English title, else the Arabic one, and keeps it unique", async () => {
    const { service, repo } = build(roster);
    repo.seriesSlugTaken.mockResolvedValueOnce(true).mockResolvedValue(false);
    await service.createSeries("editor", { titleAr: "ساحر الرياح", titleEn: "The Wind Mage" }, CTX);
    expect(repo.createSeries).toHaveBeenCalledWith(expect.objectContaining({ slug: "the-wind-mage-2" }));
    await service.createSeries("editor", { titleAr: "ساحر الرياح" }, CTX);
    expect(repo.createSeries).toHaveBeenLastCalledWith(expect.objectContaining({ slug: "ساحر-الرياح" }));
  });

  it("audits and invalidates the cache on every write", async () => {
    const { service, repo, catalog } = build(roster);
    await service.createSeries("editor", { titleAr: "س" }, CTX);
    expect(repo.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ actorId: "editor", action: "catalog.series_created" }));
    expect(catalog.invalidate).toHaveBeenCalled();
  });

  it("refuses a banned account", async () => {
    const { service, repo } = build(roster);
    repo.findActor.mockResolvedValue({ id: "editor", role: "editor", isBanned: true, bannedUntil: null });
    await expect(service.createSeries("editor", { titleAr: "س" }, CTX)).rejects.toMatchObject({ response: { code: "account_banned" } });
  });
});

describe("team permissions", () => {
  it("lets team managers create and delete teams; editors and readers cannot", async () => {
    const { service } = build(roster);
    await service.createTeam("manager", { name: "Nova" }, CTX);
    await service.createTeam("owner", { name: "Nova" }, CTX);
    await expect(service.createTeam("editor", { name: "Nova" }, CTX)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.deleteTeam("leader", "t1", CTX)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.deleteTeam("manager", "t1", CTX)).resolves.toBeUndefined();
  });

  it("lets a leader edit their team's profile but not its status or leader", async () => {
    const { service, repo } = build(roster);
    await service.updateTeam("leader", "t1", { description: "new", recruiting: true }, CTX);
    expect(repo.updateTeam).toHaveBeenCalled();
    await expect(service.updateTeam("leader", "t1", { status: "suspended" }, CTX)).rejects.toMatchObject({ response: { code: "global_manager_only" } });
    await expect(service.updateTeam("leader", "t1", { leaderUsername: "someone" }, CTX)).rejects.toMatchObject({ response: { code: "global_manager_only" } });
    await expect(service.updateTeam("manager", "t1", { status: "suspended", leaderUsername: "" }, CTX)).resolves.toBeDefined();
    expect(repo.updateTeam).toHaveBeenLastCalledWith("t1", expect.objectContaining({ status: "suspended", leaderId: null }));
  });

  it("resolves a leader by username and rejects an unknown one", async () => {
    const { service, repo } = build(roster);
    await service.createTeam("manager", { name: "Nova", leaderUsername: "rahaf" }, CTX);
    expect(repo.createTeam).toHaveBeenCalledWith(expect.objectContaining({ leaderId: "id-rahaf" }));
    await expect(service.createTeam("manager", { name: "Nova", leaderUsername: "ghost" }, CTX)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("lets managers and the team's own leader manage members, nobody else", async () => {
    const { service, repo } = build(roster);
    await service.setMember("leader", "t1", "u9", "translator", CTX);
    await service.setMember("manager", "t1", "u9", "editor", CTX);
    await service.removeMember("leader", "t1", "u9", CTX);
    await expect(service.setMember("member", "t1", "u9", "translator", CTX)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.setMember).toHaveBeenCalledTimes(2);
  });

  it("adds an account to a team by username without a recruitment post, for managers and the team's own leader only", async () => {
    const { service, repo, catalog } = build(roster);
    await expect(service.addMemberByUsername("manager", "t1", { username: "@rahaf", role: "translator" }, CTX)).resolves.toEqual({ userId: "id-rahaf", role: "translator" });
    expect(repo.setMember).toHaveBeenLastCalledWith("t1", "id-rahaf", "translator");
    await service.addMemberByUsername("leader", "t1", { username: " sara ", role: "editor" }, CTX);
    expect(repo.setMember).toHaveBeenLastCalledWith("t1", "id-sara", "editor");
    expect(repo.writeAuditLog).toHaveBeenLastCalledWith(expect.objectContaining({ action: "catalog.team_member_set" }));
    expect(catalog.invalidate).toHaveBeenCalled();

    await expect(service.addMemberByUsername("member", "t1", { username: "rahaf", role: "translator" }, CTX)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.addMemberByUsername("manager", "t1", { username: "ghost", role: "translator" }, CTX)).rejects.toMatchObject({ response: { code: "user_not_found" } });
  });
});

describe("moving series between teams", () => {
  const build2 = () => {
    const ctx = build(roster);
    const transfer = jest.fn(async (ids: string[], teamId: string | null) => ({ series: ids.length, chapters: teamId ? 7 : 0 }));
    const existing = jest.fn(async (ids: string[]) => ids.filter((id) => id !== "gone"));
    Object.assign(ctx.repo, { transferSeries: transfer, existingSeriesIds: existing });
    return { ...ctx, transfer, existing };
  };

  it("moves the series and reports how many series and chapters moved", async () => {
    const { service, transfer, repo, catalog } = build2();
    await expect(service.transferSeries("owner", { seriesIds: ["a", "b", "a"], teamId: "t1" }, CTX)).resolves.toEqual({ teamId: "t1", series: 2, chapters: 7 });
    expect(transfer).toHaveBeenCalledWith(["a", "b"], "t1");
    expect(repo.writeAuditLog).toHaveBeenLastCalledWith(expect.objectContaining({ actorId: "owner", action: "catalog.series_transferred", target: "t1:2" }));
    expect(catalog.invalidate).toHaveBeenCalled();
  });

  it("takes series off every team when the destination is empty", async () => {
    const { service, transfer } = build2();
    await expect(service.transferSeries("editor", { seriesIds: ["a"], teamId: "" }, CTX)).resolves.toEqual({ teamId: null, series: 1, chapters: 0 });
    expect(transfer).toHaveBeenCalledWith(["a"], null);
  });

  it("is for global editors only", async () => {
    const { service, transfer } = build2();
    for (const who of ["leader", "manager", "mod", "reader"]) {
      await expect(service.transferSeries(who, { seriesIds: ["a"], teamId: "t1" }, CTX)).rejects.toMatchObject({ response: { code: "global_editor_only" } });
    }
    expect(transfer).not.toHaveBeenCalled();
  });

  it("changes nothing when the team or any series does not exist", async () => {
    const { service, transfer, repo } = build2();
    await expect(service.transferSeries("owner", { seriesIds: ["a", "gone"], teamId: "t1" }, CTX)).rejects.toMatchObject({ response: { code: "series_not_found" } });
    repo.findTeamById.mockResolvedValue(null as never);
    await expect(service.transferSeries("owner", { seriesIds: ["a"], teamId: "nope" }, CTX)).rejects.toMatchObject({ response: { code: "team_not_found" } });
    expect(transfer).not.toHaveBeenCalled();
  });
});

describe("news and tags", () => {
  it("lets only news managers and above publish", async () => {
    const { service } = build(roster);
    await service.createNews("newsie", { title: "Hello world" }, CTX);
    await service.createNews("owner", { title: "Hello world" }, CTX);
    await expect(service.createNews("editor", { title: "Hello world" }, CTX)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.deleteNews("reader", "n1", CTX)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("creates a tag once and refuses a duplicate", async () => {
    const { service, repo } = build(roster);
    repo.findTagsBySlugs.mockResolvedValueOnce([]);
    await expect(service.createTag("editor", { nameEn: "Time Travel", nameAr: "سفر عبر الزمن" }, CTX)).resolves.toMatchObject({ slug: "time-travel" });
    repo.findTagsBySlugs.mockResolvedValueOnce([{ id: "x", slug: "time-travel", nameEn: "", nameAr: "", group: "genre" }]);
    await expect(service.createTag("editor", { nameEn: "Time Travel", nameAr: "سفر" }, CTX)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.createTag("reader", { nameEn: "X", nameAr: "س" }, CTX)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("images", () => {
  it("rejects a missing or unsupported file before touching storage", async () => {
    const { service, storage } = build(roster);
    await expect(service.setSeriesImage("editor", "s1", "cover", undefined, CTX)).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.setSeriesImage("editor", "s1", "cover", { mimetype: "application/pdf", buffer: Buffer.from("x") } as Express.Multer.File, CTX)
    ).rejects.toMatchObject({ response: { code: "unsupported_image_type" } });
    await expect(
      service.setSeriesImage("editor", "s1", "cover", { mimetype: "image/png", buffer: Buffer.from("not an image") } as Express.Multer.File, CTX)
    ).rejects.toMatchObject({ response: { code: "invalid_image" } });
    expect(storage.put).not.toHaveBeenCalled();
  });
});
