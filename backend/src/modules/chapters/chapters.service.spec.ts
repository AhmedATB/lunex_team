import { ForbiddenException } from "@nestjs/common";
import type { CatalogService } from "../catalog/catalog.service";
import type { ImagesService } from "../images/images.service";
import sharp from "sharp";
import type { StorageService } from "../images/storage/storage.interface";
import type { NotificationsService } from "../notifications/notifications.service";
import type { AnnouncementsService } from "../announcements/announcements.service";
import type { TeamActivityService } from "../team-activity/team-activity.service";
import type { WalletService } from "../wallet/wallet.service";
import type { ChaptersRepository } from "./chapters.repository";
import { ChaptersService } from "./chapters.service";

function build(chapter: { isPublished: boolean; publishedAt: Date | null; teamId?: string | null; scheduledFor?: Date | null } = { isPublished: false, publishedAt: null, teamId: "t1" }) {
  const repo = {
    findById: jest.fn(async () => ({ id: "c1", seriesId: "s1", number: 7, pages: [], ...chapter })),
    update: jest.fn(async (id: string, data: object) => ({ id, ...data })),
    seriesTitle: jest.fn(async () => "الوردة"),
    delete: jest.fn(async () => ({ id: "c1" })),
  };
  const catalog = { invalidate: jest.fn() };
  const notifications = { chapterPublished: jest.fn(async () => undefined) };
  const activity = { record: jest.fn(async () => undefined) };
  const announcements = { chapterPublished: jest.fn() };
  const service = new ChaptersService(
    repo as unknown as ChaptersRepository,
    {} as StorageService,
    {} as ImagesService,
    {} as WalletService,
    notifications as unknown as NotificationsService,
    catalog as unknown as CatalogService,
    activity as unknown as TeamActivityService,
    announcements as unknown as AnnouncementsService
  );
  return { service, repo, catalog, notifications, activity, announcements };
}

describe("publishing a chapter", () => {
  it("stamps the publication time, refreshes the catalogue at once and tells the followers", async () => {
    const { service, repo, catalog, notifications } = build();
    const before = Date.now();
    await service.update("owner", "c1", { isPublished: true });
    const data = repo.update.mock.calls[0][1] as { isPublished: boolean; publishedAt: Date };
    expect(data.isPublished).toBe(true);
    expect(data.publishedAt.getTime()).toBeGreaterThanOrEqual(before); // the "latest chapters" order by this, so it must not stay empty
    expect(catalog.invalidate).toHaveBeenCalledTimes(1);
    expect(notifications.chapterPublished).toHaveBeenCalledWith("s1", 7);
  });

  it("writes going live to the team's activity log, with the series' name; a work with no team has no log", async () => {
    const { service, activity } = build();
    await service.update("owner", "c1", { isPublished: true }, "boss");
    expect(activity.record).toHaveBeenCalledWith("t1", "chapter_published", { actorId: "boss", detail: "7 من الوردة" });
    const teamless = build({ isPublished: false, publishedAt: null, teamId: null });
    await teamless.service.update("owner", "c1", { isPublished: true }, "boss");
    expect(teamless.activity.record).not.toHaveBeenCalled();
    const down = build({ isPublished: true, publishedAt: new Date("2026-01-01"), teamId: "t1" });
    await down.service.update("owner", "c1", { isPublished: false }, "boss");
    expect(down.activity.record).toHaveBeenCalledWith("t1", "chapter_unpublished", { actorId: "boss", detail: "7 من الوردة" });
  });

  it("announces a chapter that goes live to the outside world — not one already live, taken down, or scheduled for later", async () => {
    const { service, announcements } = build();
    await service.update("owner", "c1", { isPublished: true });
    expect(announcements.chapterPublished).toHaveBeenCalledWith("s1", 7);

    const live = build({ isPublished: true, publishedAt: new Date("2026-01-01") });
    await live.service.update("owner", "c1", { isPublished: true });
    await live.service.update("owner", "c1", { isPublished: false });
    expect(live.announcements.chapterPublished).not.toHaveBeenCalled();

    const later = build({ isPublished: false, publishedAt: null, teamId: "t1", scheduledFor: new Date(Date.now() + 3_600_000) });
    await later.service.update("owner", "c1", { isPublished: true });
    expect(later.announcements.chapterPublished).not.toHaveBeenCalled();
  });

  it("clears the time when a chapter is taken down", async () => {
    const { service, repo, catalog, notifications } = build({ isPublished: true, publishedAt: new Date("2026-01-01") });
    await service.update("owner", "c1", { isPublished: false });
    expect(repo.update).toHaveBeenCalledWith("c1", { isPublished: false, publishedAt: null });
    expect(catalog.invalidate).toHaveBeenCalledTimes(1);
    expect(notifications.chapterPublished).not.toHaveBeenCalled();
  });

  it("leaves the time alone for a change that is not going live or coming down, and does not tell followers twice", async () => {
    const live = new Date("2026-01-01");
    const { service, repo, notifications } = build({ isPublished: true, publishedAt: live });
    await service.update("owner", "c1", { manualLock: true });
    await service.update("owner", "c1", { isPublished: true }); // already live
    expect(repo.update.mock.calls[0][1]).toEqual({ manualLock: true });
    expect(repo.update.mock.calls[1][1]).toEqual({ isPublished: true });
    expect(notifications.chapterPublished).not.toHaveBeenCalled();
  });

  it("is for people who publish, and deleting a chapter refreshes the catalogue too", async () => {
    const { service, catalog } = build();
    await expect(service.update("reader", "c1", { isPublished: true })).rejects.toBeInstanceOf(ForbiddenException);
    await service.remove("owner", "c1");
    expect(catalog.invalidate).toHaveBeenCalledTimes(1);
  });
});

describe("replacing one page", () => {
  const picture = () => sharp({ create: { width: 60, height: 90, channels: 3, background: "#7c3aed" } }).png().toBuffer().then((buffer) => ({ buffer, mimetype: "image/png" }) as Express.Multer.File);

  function setup(pageExists = true) {
    const repo = {
      findById: jest.fn(async () => ({ id: "c1", seriesId: "s1", number: 7, pages: [] })),
      findPage: jest.fn(async () => (pageExists ? { id: "p1", chapterId: "c1", pageNumber: 3, assetId: "old" } : null)),
      createAsset: jest.fn(async () => ({ id: "new-asset" })),
      updatePageAsset: jest.fn(async () => ({})),
    };
    const storage = { put: jest.fn(async () => ({ checksum: "sum" })) };
    const service = new ChaptersService(repo as unknown as ChaptersRepository, storage as unknown as StorageService, {} as ImagesService, {} as WalletService, {} as NotificationsService, {} as CatalogService, {} as TeamActivityService, {} as AnnouncementsService);
    return { service, repo, storage };
  }

  it("stores the new picture as a WebP and points the same page number at it", async () => {
    const { service, repo, storage } = setup();
    expect(await service.replacePage("uploader", "c1", 3, await picture())).toEqual({ pageNumber: 3 });
    expect(storage.put).toHaveBeenCalledWith(expect.stringMatching(/^chapters\/.+\.webp$/), expect.any(Buffer));
    expect(repo.createAsset).toHaveBeenCalledWith(expect.objectContaining({ mimeType: "image/webp" }));
    expect(repo.updatePageAsset).toHaveBeenCalledWith("c1", 3, "new-asset");
  });

  it("is for the people who publish, needs a file, and refuses a page the chapter does not have", async () => {
    await expect(setup().service.replacePage("reader", "c1", 3, await picture())).rejects.toBeInstanceOf(ForbiddenException);
    await expect(setup().service.replacePage("uploader", "c1", 3, undefined)).rejects.toMatchObject({ response: { code: "missing_file" } });
    await expect(setup(false).service.replacePage("uploader", "c1", 9, await picture())).rejects.toMatchObject({ response: { code: "page_not_found" } });
  });

  it("changes nothing when the file cannot be read as a picture", async () => {
    const { service, repo, storage } = setup();
    await expect(service.replacePage("uploader", "c1", 3, { buffer: Buffer.from("not a picture"), mimetype: "image/png" } as Express.Multer.File)).rejects.toBeDefined();
    expect(storage.put).not.toHaveBeenCalled();
    expect(repo.updatePageAsset).not.toHaveBeenCalled();
  });
});
