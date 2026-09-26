import { ForbiddenException } from "@nestjs/common";
import type { CatalogService } from "../catalog/catalog.service";
import type { ImagesService } from "../images/images.service";
import type { StorageService } from "../images/storage/storage.interface";
import type { NotificationsService } from "../notifications/notifications.service";
import type { TeamActivityService } from "../team-activity/team-activity.service";
import type { WalletService } from "../wallet/wallet.service";
import type { ChaptersRepository } from "./chapters.repository";
import { ChaptersService } from "./chapters.service";

function build(chapter: { isPublished: boolean; publishedAt: Date | null; teamId?: string | null } = { isPublished: false, publishedAt: null, teamId: "t1" }) {
  const repo = {
    findById: jest.fn(async () => ({ id: "c1", seriesId: "s1", number: 7, pages: [], ...chapter })),
    update: jest.fn(async (id: string, data: object) => ({ id, ...data })),
    seriesTitle: jest.fn(async () => "الوردة"),
    delete: jest.fn(async () => ({ id: "c1" })),
  };
  const catalog = { invalidate: jest.fn() };
  const notifications = { chapterPublished: jest.fn(async () => undefined) };
  const activity = { record: jest.fn(async () => undefined) };
  const service = new ChaptersService(
    repo as unknown as ChaptersRepository,
    {} as StorageService,
    {} as ImagesService,
    {} as WalletService,
    notifications as unknown as NotificationsService,
    catalog as unknown as CatalogService,
    activity as unknown as TeamActivityService
  );
  return { service, repo, catalog, notifications, activity };
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
