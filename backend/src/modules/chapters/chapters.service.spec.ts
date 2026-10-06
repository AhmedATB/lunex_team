import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { CatalogService } from "../catalog/catalog.service";
import type { ImagesService } from "../images/images.service";
import sharp from "sharp";
import type { StorageService } from "../images/storage/storage.interface";
import type { NotificationsService } from "../notifications/notifications.service";
import type { AnnouncementsService } from "../announcements/announcements.service";
import type { TeamAccessService, TeamLevel } from "../team-access/team-access.service";
import type { TeamActivityService } from "../team-activity/team-activity.service";
import type { WalletService } from "../wallet/wallet.service";
import type { ChaptersRepository } from "./chapters.repository";
import { ChaptersService } from "./chapters.service";

const OWNER = { id: "u-owner", role: "owner" };
const READER = { id: "u-reader", role: "reader" };
const BOT = { id: null, role: "uploader" };

/** A reader account whose place in team `t1` (the one that owns series `s1`) is `level`; null = not in it. */
function teamAccessFor(level: TeamLevel | null) {
  return { levelFor: jest.fn(async (_userId: string, _teamId: string): Promise<TeamLevel | null> => level), accessFor: jest.fn(async () => (level ? [{ teamId: "t1", slug: "t", name: "T", level }] : [])) };
}

function build(chapter: { isPublished: boolean; publishedAt: Date | null; teamId?: string | null; scheduledFor?: Date | null } = { isPublished: false, publishedAt: null, teamId: "t1" }, level: TeamLevel | null = null, seriesState = "approved") {
  const repo = {
    findById: jest.fn(async () => ({ id: "c1", seriesId: "s1", number: 7, pages: [], ...chapter })),
    update: jest.fn(async (id: string, data: object) => ({ id, ...data })),
    seriesTitle: jest.fn(async () => "الوردة"),
    delete: jest.fn(async () => ({ id: "c1" })),
    seriesAccess: jest.fn(async (): Promise<{ teamId: string | null; state: string }> => ({ teamId: "t1", state: seriesState })),
    collaboratorTeamIds: jest.fn(async (): Promise<string[]> => []),
    create: jest.fn(async (data: object) => ({ id: "new", ...data })),
    listRecent: jest.fn(async () => []),
  };
  const catalog = { invalidate: jest.fn() };
  const notifications = { chapterPublished: jest.fn(async () => undefined) };
  const activity = { record: jest.fn(async () => undefined) };
  const announcements = { chapterPublished: jest.fn() };
  const teamAccess = teamAccessFor(level);
  const service = new ChaptersService(
    repo as unknown as ChaptersRepository,
    {} as StorageService,
    {} as ImagesService,
    {} as WalletService,
    notifications as unknown as NotificationsService,
    catalog as unknown as CatalogService,
    activity as unknown as TeamActivityService,
    announcements as unknown as AnnouncementsService,
    teamAccess as unknown as TeamAccessService
  );
  return { service, repo, catalog, notifications, activity, announcements, teamAccess };
}

describe("publishing a chapter", () => {
  it("stamps the publication time, refreshes the catalogue at once and tells the followers", async () => {
    const { service, repo, catalog, notifications } = build();
    const before = Date.now();
    await service.update(OWNER, "c1", { isPublished: true });
    const data = repo.update.mock.calls[0][1] as { isPublished: boolean; publishedAt: Date };
    expect(data.isPublished).toBe(true);
    expect(data.publishedAt.getTime()).toBeGreaterThanOrEqual(before); // the "latest chapters" order by this, so it must not stay empty
    expect(catalog.invalidate).toHaveBeenCalledTimes(1);
    expect(notifications.chapterPublished).toHaveBeenCalledWith("s1", 7);
  });

  it("writes going live to the team's activity log, with the series' name; a work with no team has no log", async () => {
    const { service, activity } = build();
    await service.update(OWNER, "c1", { isPublished: true });
    expect(activity.record).toHaveBeenCalledWith("t1", "chapter_published", { actorId: "u-owner", detail: "7 من الوردة" });
    const teamless = build({ isPublished: false, publishedAt: null, teamId: null });
    await teamless.service.update(OWNER, "c1", { isPublished: true });
    expect(teamless.activity.record).not.toHaveBeenCalled();
    const down = build({ isPublished: true, publishedAt: new Date("2026-01-01"), teamId: "t1" });
    await down.service.update(OWNER, "c1", { isPublished: false });
    expect(down.activity.record).toHaveBeenCalledWith("t1", "chapter_unpublished", { actorId: "u-owner", detail: "7 من الوردة" });
  });

  it("announces a chapter that goes live to the outside world — not one already live, taken down, or scheduled for later", async () => {
    const { service, announcements } = build();
    await service.update(OWNER, "c1", { isPublished: true });
    expect(announcements.chapterPublished).toHaveBeenCalledWith("s1", 7);

    const live = build({ isPublished: true, publishedAt: new Date("2026-01-01") });
    await live.service.update(OWNER, "c1", { isPublished: true });
    await live.service.update(OWNER, "c1", { isPublished: false });
    expect(live.announcements.chapterPublished).not.toHaveBeenCalled();

    const later = build({ isPublished: false, publishedAt: null, teamId: "t1", scheduledFor: new Date(Date.now() + 3_600_000) });
    await later.service.update(OWNER, "c1", { isPublished: true });
    expect(later.announcements.chapterPublished).not.toHaveBeenCalled();
  });

  it("clears the time when a chapter is taken down", async () => {
    const { service, repo, catalog, notifications } = build({ isPublished: true, publishedAt: new Date("2026-01-01") });
    await service.update(OWNER, "c1", { isPublished: false });
    expect(repo.update).toHaveBeenCalledWith("c1", { isPublished: false, publishedAt: null });
    expect(catalog.invalidate).toHaveBeenCalledTimes(1);
    expect(notifications.chapterPublished).not.toHaveBeenCalled();
  });

  it("leaves the time alone for a change that is not going live or coming down, and does not tell followers twice", async () => {
    const live = new Date("2026-01-01");
    const { service, repo, notifications } = build({ isPublished: true, publishedAt: live });
    await service.update(OWNER, "c1", { manualLock: true });
    await service.update(OWNER, "c1", { isPublished: true }); // already live
    expect(repo.update.mock.calls[0][1]).toEqual({ manualLock: true });
    expect(repo.update.mock.calls[1][1]).toEqual({ isPublished: true });
    expect(notifications.chapterPublished).not.toHaveBeenCalled();
  });

  it("is for people who publish, and deleting a chapter refreshes the catalogue too", async () => {
    const { service, catalog } = build();
    await expect(service.update(READER, "c1", { isPublished: true })).rejects.toBeInstanceOf(ForbiddenException);
    await service.remove(OWNER, "c1");
    expect(catalog.invalidate).toHaveBeenCalledTimes(1);
  });
});

describe("replacing one page", () => {
  const picture = () => sharp({ create: { width: 60, height: 90, channels: 3, background: "#7c3aed" } }).png().toBuffer().then((buffer) => ({ buffer, mimetype: "image/png" }) as Express.Multer.File);

  function setup(pageExists = true) {
    const repo = {
      findById: jest.fn(async () => ({ id: "c1", seriesId: "s1", number: 7, pages: [] })),
      seriesAccess: jest.fn(async () => ({ teamId: "t1", state: "approved" })),
      collaboratorTeamIds: jest.fn(async () => []),
      findPage: jest.fn(async () => (pageExists ? { id: "p1", chapterId: "c1", pageNumber: 3, assetId: "old" } : null)),
      createAsset: jest.fn(async () => ({ id: "new-asset" })),
      updatePageAsset: jest.fn(async () => ({})),
    };
    const storage = { put: jest.fn(async () => ({ checksum: "sum" })) };
    const service = new ChaptersService(repo as unknown as ChaptersRepository, storage as unknown as StorageService, {} as ImagesService, {} as WalletService, {} as NotificationsService, {} as CatalogService, {} as TeamActivityService, {} as AnnouncementsService, teamAccessFor(null) as unknown as TeamAccessService);
    return { service, repo, storage };
  }

  it("stores the new picture as a WebP and points the same page number at it", async () => {
    const { service, repo, storage } = setup();
    expect(await service.replacePage(OWNER, "c1", 3, await picture())).toEqual({ pageNumber: 3 });
    expect(storage.put).toHaveBeenCalledWith(expect.stringMatching(/^chapters\/.+\.webp$/), expect.any(Buffer));
    expect(repo.createAsset).toHaveBeenCalledWith(expect.objectContaining({ mimeType: "image/webp" }));
    expect(repo.updatePageAsset).toHaveBeenCalledWith("c1", 3, "new-asset");
  });

  it("is for the people who publish, needs a file, and refuses a page the chapter does not have", async () => {
    await expect(setup().service.replacePage(READER, "c1", 3, await picture())).rejects.toBeInstanceOf(ForbiddenException);
    await expect(setup().service.replacePage(OWNER, "c1", 3, undefined)).rejects.toMatchObject({ response: { code: "missing_file" } });
    await expect(setup(false).service.replacePage(OWNER, "c1", 9, await picture())).rejects.toMatchObject({ response: { code: "page_not_found" } });
  });

  it("changes nothing when the file cannot be read as a picture", async () => {
    const { service, repo, storage } = setup();
    await expect(service.replacePage(OWNER, "c1", 3, { buffer: Buffer.from("not a picture"), mimetype: "image/png" } as Express.Multer.File)).rejects.toBeDefined();
    expect(storage.put).not.toHaveBeenCalled();
    expect(repo.updatePageAsset).not.toHaveBeenCalled();
  });
});

describe("who may work on a team's chapters", () => {
  const MEMBER = { id: "u-member", role: "reader" }; // an ordinary account: all the power comes from the place in the team
  const asLevel = (level: TeamLevel | null, seriesState = "approved") => build(undefined, level, seriesState);

  it("lets the team's leads, publishers and uploaders create a chapter, always under the team that owns the series", async () => {
    for (const level of ["lead", "publisher", "uploader"] as const) {
      const { service, repo } = asLevel(level);
      await service.create(MEMBER, { seriesId: "s1", teamId: "someone-elses-team", number: 3, title: "t" });
      expect(repo.create).toHaveBeenCalledWith({ seriesId: "s1", teamId: "t1", number: 3, title: "t" });
    }
  });

  it("refuses the others — a member with another role, a stranger, a series with no team", async () => {
    const stranger = asLevel(null);
    await expect(stranger.service.create(MEMBER, { seriesId: "s1", number: 1, title: "t" })).rejects.toBeInstanceOf(ForbiddenException);
    const teamless = asLevel("lead");
    teamless.repo.seriesAccess.mockResolvedValueOnce({ teamId: null, state: "approved" });
    await expect(teamless.service.create(MEMBER, { seriesId: "s1", number: 1, title: "t" })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(stranger.service.requireUploader(MEMBER, "c1")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(stranger.service.requireAnyUploader(MEMBER)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("keeps the site's staff and the bot working on any series, choosing the team themselves", async () => {
    const { service, repo } = asLevel(null);
    await service.create(OWNER, { seriesId: "s1", teamId: " t9 ", number: 1, title: "t" });
    await service.create(BOT, { seriesId: "s1", number: 2, title: "t" });
    expect(repo.create.mock.calls.map((call) => (call[0] as { teamId: string | null }).teamId)).toEqual(["t9", null]);
    await expect(service.requireUploader(OWNER, "c1")).resolves.toMatchObject({ id: "c1" });
    await expect(service.requireAnyUploader(BOT)).resolves.toBeUndefined();
  });

  it("puts a chapter live or takes it down for leads and publishers, not for an uploader", async () => {
    for (const level of ["lead", "publisher"] as const) {
      const { service, repo } = asLevel(level);
      await service.update(MEMBER, "c1", { isPublished: true });
      expect(repo.update).toHaveBeenCalledTimes(1);
    }
    const uploader = asLevel("uploader");
    await expect(uploader.service.update(MEMBER, "c1", { isPublished: true })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(asLevel(null).service.update(MEMBER, "c1", { isPublished: true })).rejects.toBeInstanceOf(ForbiddenException);
    expect(uploader.repo.update).not.toHaveBeenCalled();
  });

  it("keeps the lock (what costs coins) for the site's staff, even from a team's leader", async () => {
    const { service, repo } = asLevel("lead");
    await expect(service.update(MEMBER, "c1", { manualLock: true })).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.update).not.toHaveBeenCalled();
    await service.update(OWNER, "c1", { manualLock: true });
    expect(repo.update).toHaveBeenCalledWith("c1", { manualLock: true });
  });

  it("does not let a chapter of a series still waiting for approval go live — for anyone", async () => {
    const lead = asLevel("lead", "pending");
    await expect(lead.service.update(MEMBER, "c1", { isPublished: true })).rejects.toBeInstanceOf(ConflictException);
    const owner = asLevel(null, "pending");
    await expect(owner.service.update(OWNER, "c1", { isPublished: true })).rejects.toMatchObject({ response: { code: "series_not_approved" } });
    expect(owner.repo.update).not.toHaveBeenCalled();
    // taking one down, or any other change, is fine
    const down = build({ isPublished: true, publishedAt: new Date("2026-01-01"), teamId: "t1" }, "lead", "pending");
    await down.service.update(MEMBER, "c1", { isPublished: false });
    expect(down.repo.update).toHaveBeenCalledTimes(1);
  });

  it("deletes a chapter only for the staff and the team's leads", async () => {
    const lead = asLevel("lead");
    await lead.service.remove(MEMBER, "c1");
    expect(lead.repo.delete).toHaveBeenCalledWith("c1");
    for (const level of ["publisher", "uploader", null] as const) {
      const other = asLevel(level);
      await expect(other.service.remove(MEMBER, "c1")).rejects.toBeInstanceOf(ForbiddenException);
      expect(other.repo.delete).not.toHaveBeenCalled();
    }
  });

  it("shows a team's people only the chapters of their own team's series, and the staff all of them", async () => {
    const team = asLevel("uploader");
    await team.service.listRecentForAdmin(MEMBER);
    expect(team.repo.listRecent).toHaveBeenCalledWith(50, ["t1"]);
    await expect(asLevel(null).service.listRecentForAdmin(MEMBER)).rejects.toBeInstanceOf(ForbiddenException);
    const staff = asLevel(null);
    await staff.service.listRecentForAdmin(OWNER);
    expect(staff.repo.listRecent).toHaveBeenCalledWith(50);
  });
});

describe("checking a chapter before it is published", () => {
  const MEMBER = { id: "u-member", role: "reader" };
  const pages = [1, 2, 3].map((pageNumber) => ({ pageNumber, assetId: `a${pageNumber}` }));

  function setup(level: TeamLevel | null = "uploader", chapterPages = pages) {
    const built = build(undefined, level);
    const repo = Object.assign(built.repo, {
      findById: jest.fn(async () => ({ id: "c1", seriesId: "s1", number: 7, isPublished: false, publishedAt: null, teamId: "t1", pages: chapterPages })),
      findBySeriesAndNumber: jest.fn(async (): Promise<{ id: string } | null> => null),
      deletePageAndClose: jest.fn(async () => undefined),
      swapPageNumbers: jest.fn(async () => undefined),
    });
    return { ...built, repo };
  }

  it("lets anyone who works on the chapters correct its title and number, but not reuse another chapter's number", async () => {
    const { service, repo } = setup("uploader");
    await service.update(MEMBER, "c1", { title: "  البداية  ", number: 8 });
    expect(repo.update).toHaveBeenCalledWith("c1", { title: "البداية", number: 8 });
    repo.findBySeriesAndNumber.mockResolvedValueOnce({ id: "other" });
    await expect(service.update(MEMBER, "c1", { number: 9 })).rejects.toMatchObject({ response: { code: "chapter_number_taken" } });
    await expect(service.update(MEMBER, "c1", { title: "   " })).rejects.toMatchObject({ response: { code: "invalid_title" } });
    await expect(setup(null).service.update(MEMBER, "c1", { title: "x" })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("takes a page out and closes the gap, but never the last page", async () => {
    const { service, repo } = setup();
    expect(await service.removePage(MEMBER, "c1", 2)).toEqual({ pages: 2 });
    expect(repo.deletePageAndClose).toHaveBeenCalledWith("c1", 2);
    await expect(service.removePage(MEMBER, "c1", 9)).rejects.toMatchObject({ response: { code: "page_not_found" } });
    await expect(setup("uploader", [pages[0]]).service.removePage(MEMBER, "c1", 1)).rejects.toMatchObject({ response: { code: "last_page" } });
    await expect(setup(null).service.removePage(MEMBER, "c1", 2)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("moves a page by swapping the places of two pages", async () => {
    const { service, repo } = setup();
    expect(await service.swapPages(MEMBER, "c1", 1, 2)).toEqual({ swapped: true });
    expect(repo.swapPageNumbers).toHaveBeenCalledWith("c1", 1, 2);
    await expect(service.swapPages(MEMBER, "c1", 1, 5)).rejects.toMatchObject({ response: { code: "page_not_found" } });
  });
});

describe("page pictures for the team's own preview", () => {
  function setup(level: TeamLevel | null, canRead: boolean) {
    const repo = {
      findById: jest.fn(async () => ({ id: "c1", seriesId: "s1", number: 7, teamId: "t1", pages: [{ pageNumber: 1, assetId: "a1" }] })),
      seriesAccess: jest.fn(async () => ({ teamId: "t1", state: "approved" })),
      collaboratorTeamIds: jest.fn(async () => []),
    };
    const images = { issueToken: jest.fn(async () => ({ token: "t" })) };
    // like the real wallet, a chapter readers cannot open (here: a draft) is "not found" to it
    const wallet = { access: jest.fn(async () => (canRead ? { locked: false, canRead } : Promise.reject(new NotFoundException()))) };
    const service = new ChaptersService(repo as unknown as ChaptersRepository, {} as StorageService, images as unknown as ImagesService, wallet as unknown as WalletService, {} as NotificationsService, {} as CatalogService, {} as TeamActivityService, {} as AnnouncementsService, teamAccessFor(level) as unknown as TeamAccessService);
    return { service, images };
  }
  const ctx = {} as never;

  it("lets the team read its unpublished chapter, and still keeps it from everyone else", async () => {
    const team = setup("uploader", false);
    await expect(team.service.issuePageToken({ id: "u-member", role: "reader" }, "c1", 1, ctx)).resolves.toEqual({ token: "t" });
    await expect(setup(null, false).service.issuePageToken({ id: "u-x", role: "reader" }, "c1", 1, ctx)).rejects.toBeInstanceOf(NotFoundException);
    await expect(setup(null, false).service.issuePageToken(null, "c1", 1, ctx)).rejects.toBeInstanceOf(NotFoundException);
    await expect(setup(null, true).service.issuePageToken(null, "c1", 1, ctx)).resolves.toEqual({ token: "t" });
  });
});

describe("a collaborating team's chapters", () => {
  const HELPER = { id: "u-helper", role: "reader" };

  /** `helper` is a member of team t2, which collaborates on series s1 (owned by t1); the chapter is credited to `chapterTeam`. */
  function setup(level: TeamLevel, chapterTeam: string | null = "t2", collaborates = true) {
    const built = build({ isPublished: false, publishedAt: null, teamId: chapterTeam });
    built.repo.collaboratorTeamIds.mockResolvedValue(collaborates ? ["t2"] : []);
    built.teamAccess.levelFor.mockImplementation(async (_user: string, teamId: string) => (teamId === "t2" ? level : null));
    return built;
  }

  it("adds a chapter to the work, credited to the collaborating team", async () => {
    const { service, repo } = setup("uploader");
    await service.create(HELPER, { seriesId: "s1", teamId: "t1", number: 4, title: "t" });
    expect(repo.create).toHaveBeenCalledWith({ seriesId: "s1", teamId: "t2", number: 4, title: "t" });
    await expect(setup("uploader", "t2", false).service.create(HELPER, { seriesId: "s1", number: 4, title: "t" })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("publishes and deletes its own chapters, never the owner's", async () => {
    const own = setup("lead", "t2");
    await own.service.update(HELPER, "c1", { isPublished: true });
    await own.service.remove(HELPER, "c1");
    expect(own.repo.delete).toHaveBeenCalled();
    const owners = setup("lead", "t1");
    await expect(owners.service.update(HELPER, "c1", { isPublished: true })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(owners.service.remove(HELPER, "c1")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(owners.service.requireUploader(HELPER, "c1")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets the owning team manage the collaborator's chapters too", async () => {
    const { service, repo } = build({ isPublished: false, publishedAt: null, teamId: "t2" }, "lead");
    await service.update({ id: "u-owner-lead", role: "reader" }, "c1", { isPublished: true });
    expect(repo.update).toHaveBeenCalled();
  });
});
