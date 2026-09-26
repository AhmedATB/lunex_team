import { NotFoundException } from "@nestjs/common";
import type { CatalogService } from "./catalog.service";
import type { EngagementRepository } from "./engagement.repository";
import type { ProgressService } from "../progress/progress.service";
import { EngagementService } from "./engagement.service";

function build(overrides: Partial<Record<keyof EngagementRepository, jest.Mock>> = {}) {
  const repo = {
    findPublishedChapter: jest.fn(async (id: string) => (id === "c1" ? { id: "c1", seriesId: "s1" } : null)),
    seriesExists: jest.fn(async (id: string) => id === "s1"),
    recordView: jest.fn(async () => true),
    upsertRating: jest.fn(async () => ({ value: 4 })),
    deleteRating: jest.fn(async () => ({ count: 1 })),
    findRating: jest.fn(async () => ({ value: 4 })),
    ratingSummary: jest.fn(async () => ({ average: 4.3333, count: 3 })),
    ...overrides,
  };
  const catalog = { invalidate: jest.fn() };
  const progress = { awardRating: jest.fn(async () => undefined) };
  return { service: new EngagementService(repo as unknown as EngagementRepository, catalog as unknown as CatalogService, progress as unknown as ProgressService), repo, catalog, progress };
}

describe("recording a view", () => {
  it("counts a chapter opened by a reader, on that day (UTC)", async () => {
    const { service, repo } = build();
    const result = await service.recordView("u1", "c1", new Date("2026-09-25T23:30:00Z"));
    expect(result).toEqual({ counted: true });
    expect(repo.recordView).toHaveBeenCalledWith({ chapterId: "c1", seriesId: "s1", userId: "u1", day: new Date("2026-09-25T00:00:00Z") });
  });

  it("reports a repeat the same day as not counted", async () => {
    const { service } = build({ recordView: jest.fn(async () => false) });
    expect(await service.recordView("u1", "c1")).toEqual({ counted: false });
  });

  it("refuses a chapter that does not exist or is not published", async () => {
    const { service, repo } = build();
    await expect(service.recordView("u1", "nope")).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.recordView).not.toHaveBeenCalled();
  });
});

describe("ratings", () => {
  it("saves the rating, drops the catalogue cache and answers with the live numbers and the reader's own", async () => {
    const { service, repo, catalog } = build();
    const result = await service.setRating("u1", "s1", 4);
    expect(repo.upsertRating).toHaveBeenCalledWith("u1", "s1", 4);
    expect(catalog.invalidate).toHaveBeenCalled();
    expect(result).toEqual({ average: 4.3, count: 3, mine: 4 });
  });

  it("says mine is null for a reader who has not rated", async () => {
    const { service } = build({ findRating: jest.fn(async () => null) });
    expect((await service.rating("u1", "s1")).mine).toBeNull();
  });

  it("clears a rating and drops the cache", async () => {
    const { service, repo, catalog } = build();
    await service.clearRating("u1", "s1");
    expect(repo.deleteRating).toHaveBeenCalledWith("u1", "s1");
    expect(catalog.invalidate).toHaveBeenCalled();
  });

  it("refuses a series that does not exist", async () => {
    const { service, repo } = build();
    await expect(service.setRating("u1", "ghost", 5)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.rating("u1", "ghost")).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.upsertRating).not.toHaveBeenCalled();
  });
});

describe("rating a series and experience", () => {
  it("pays experience for a first rating only, not for changing it", async () => {
    const first = build({ findRating: jest.fn(async () => null) });
    await first.service.setRating("u1", "s1", 5);
    expect(first.progress.awardRating).toHaveBeenCalledWith("u1");

    const changed = build({ findRating: jest.fn(async () => ({ value: 3 })) });
    await changed.service.setRating("u1", "s1", 5);
    expect(changed.progress.awardRating).not.toHaveBeenCalled();
  });
});
