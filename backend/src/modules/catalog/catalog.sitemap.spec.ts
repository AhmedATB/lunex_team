import type { StorageService } from "../images/storage/storage.interface";
import type { CatalogRepository } from "./catalog.repository";
import { CatalogService } from "./catalog.service";

const at = (iso: string) => new Date(iso);

function build() {
  const repo = {
    listSitemapSeries: jest.fn(async () => [
      { id: "s1", slug: "moon-rose", updatedAt: at("2026-09-20T00:00:00Z") },
      { id: "s2", slug: "no-chapters-yet", updatedAt: at("2026-09-01T00:00:00Z") },
    ]),
    listSitemapChapters: jest.fn(async () => [
      { seriesId: "s1", number: 10.5, publishedAt: at("2026-09-19T00:00:00Z"), createdAt: at("2026-09-10T00:00:00Z") },
      { seriesId: "s1", number: 2, publishedAt: null, createdAt: at("2026-09-02T00:00:00Z") },
      { seriesId: "s1", number: 10, publishedAt: at("2026-09-18T00:00:00Z"), createdAt: at("2026-09-11T00:00:00Z") },
      { seriesId: "gone", number: 1, publishedAt: at("2026-09-01T00:00:00Z"), createdAt: at("2026-09-01T00:00:00Z") },
    ]),
  };
  return { service: new CatalogService(repo as unknown as CatalogRepository, {} as StorageService), repo };
}

describe("the sitemap index", () => {
  it("lists each listed series with its published chapters, oldest first, and skips chapters of a series that is not listed", async () => {
    const { service } = build();
    const { series } = await service.sitemap();
    expect(series.map((s) => s.slug)).toEqual(["moon-rose", "no-chapters-yet"]);
    expect(series[0].chapters.map((c) => c.number)).toEqual([2, 10, 10.5]);
    expect(series[1].chapters).toEqual([]);
  });

  it("dates a chapter by when it went live, and by when it was made if that was never recorded", async () => {
    const { service } = build();
    const { series } = await service.sitemap();
    expect(series[0].chapters).toEqual([
      { number: 2, at: "2026-09-02T00:00:00.000Z" },
      { number: 10, at: "2026-09-18T00:00:00.000Z" },
      { number: 10.5, at: "2026-09-19T00:00:00.000Z" },
    ]);
  });

  it("is kept for a minute, and a catalogue write drops it", async () => {
    const { service, repo } = build();
    await service.sitemapCached();
    await service.sitemapCached();
    expect(repo.listSitemapSeries).toHaveBeenCalledTimes(1);
    service.invalidate();
    await service.sitemapCached();
    expect(repo.listSitemapSeries).toHaveBeenCalledTimes(2);
  });
});
