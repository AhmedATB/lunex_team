import { ConflictException } from "@nestjs/common";
import sharp from "sharp";
import type { StorageService } from "../../images/storage/storage.interface";
import type { CatalogRepository } from "../catalog.repository";
import type { CatalogService } from "../catalog.service";
import { LegacyChapterImportService } from "./legacy-chapter-import.service";

const SERIES = { id: "s1", slug: "goddess", legacyId: "M1", teamId: "t1" };
const oldChapter = (id: string, chapter: string, pages: number, extra: Record<string, unknown> = {}) => ({
  id,
  attributes: { chapter, title: "", publishAt: "2026-07-28T13:03:01.551Z", pages, ...extra },
});

type Local = { id: string; isPublished: boolean; pages: { pageNumber: number }[] } | null;

interface Setup {
  feed: unknown[];
  read: Record<string, { baseUrl: string; chapter: { hash: string; data: string[] } }>;
  local: Record<string, Local>;
  failImages?: (url: string) => boolean;
  /** Bytes served for every image; a small PNG by default. */
  image?: Buffer;
}

async function build(setup: Setup) {
  const png = await sharp({ create: { width: 4, height: 6, channels: 3, background: "#ff0000" } }).png().toBuffer();

  const repo = {
    listImportedSeries: jest.fn(async () => [SERIES]),
    findChapterByLegacyId: jest.fn(async (legacyId: string) => setup.local[legacyId] ?? null),
    chapterNumberTaken: jest.fn(async () => false),
    createImportedChapter: jest.fn(async () => ({ id: "new-chapter" })),
    addChapterPage: jest.fn(async () => ({ id: "page" })),
    publishImportedChapter: jest.fn(async () => ({ id: "x" })),
  };
  const catalog = { invalidate: jest.fn() };
  const storage = { put: jest.fn(async () => ({ checksum: "abc" })), get: jest.fn() };
  const fetched: string[] = [];

  global.fetch = jest.fn(async (input: string | URL | Request) => {
    const url = String(input);
    fetched.push(url);
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (url.includes("/feed")) return json({ data: setup.feed });
    const read = url.match(/\/read\/([^/?]+)/);
    if (read) return json(setup.read[read[1]] ?? { baseUrl: "https://cdn.lunexteam.com", chapter: { hash: "h", data: [] } });
    if (setup.failImages?.(url)) return new Response("nope", { status: 500 });
    return new Response(new Uint8Array(setup.image ?? png), { status: 200 });
  }) as typeof fetch;

  const service = new LegacyChapterImportService(repo as unknown as CatalogRepository, catalog as unknown as CatalogService, storage as unknown as StorageService);
  return { service, repo, catalog, storage, fetched };
}

const CDN = "https://cdn.lunexteam.com";

describe("LegacyChapterImportService", () => {
  const originalFetch = global.fetch;
  const originalBackend = process.env.IMAGE_STORAGE_BACKEND;

  beforeEach(() => {
    process.env.IMAGE_STORAGE_BACKEND = "local";
  });
  afterAll(() => {
    global.fetch = originalFetch;
    if (originalBackend === undefined) delete process.env.IMAGE_STORAGE_BACKEND;
    else process.env.IMAGE_STORAGE_BACKEND = originalBackend;
  });

  it("refuses to run while page images would go into the database", async () => {
    delete process.env.IMAGE_STORAGE_BACKEND;
    const { service, repo } = await build({ feed: [], read: {}, local: {} });
    await expect(service.importChapters()).rejects.toBeInstanceOf(ConflictException);
    expect(repo.listImportedSeries).not.toHaveBeenCalled();
  });

  it("stores every page, then publishes the chapter with its old release date and the series' team", async () => {
    const { service, repo, storage, catalog } = await build({
      feed: [oldChapter("C1", "1", 2), oldChapter("C2", "2", 0)],
      read: { C1: { baseUrl: CDN, chapter: { hash: "h1", data: ["a.jpg", "b.jpg"] } } },
      local: {},
    });

    const report = await service.importChapters();

    expect(repo.createImportedChapter).toHaveBeenCalledWith({ seriesId: "s1", teamId: "t1", number: 1, title: "", legacyId: "C1" });
    expect(storage.put).toHaveBeenCalledTimes(2);
    expect(repo.addChapterPage).toHaveBeenCalledTimes(2);
    expect(repo.addChapterPage).toHaveBeenCalledWith(expect.objectContaining({ chapterId: "new-chapter", pageNumber: 1, mimeType: "image/webp", width: 4, height: 6 }));
    expect(repo.addChapterPage).toHaveBeenCalledWith(expect.objectContaining({ pageNumber: 2 }));
    expect(repo.publishImportedChapter).toHaveBeenCalledWith("new-chapter", new Date("2026-07-28T13:03:01.551Z"));
    expect(report).toMatchObject({ done: true, remaining: 0, chapters: { published: 1, noPages: 1, failed: 0 }, pages: { saved: 2, failed: 0 } });
    expect(catalog.invalidate).toHaveBeenCalled();
  });

  it("stores a WebP page exactly as the old site serves it, without re-encoding", async () => {
    const webp = await sharp({ create: { width: 8, height: 12, channels: 3, background: "#00ff00" } }).webp({ quality: 40 }).toBuffer();
    const { service, storage } = await build({
      feed: [oldChapter("C1", "1", 1)],
      read: { C1: { baseUrl: CDN, chapter: { hash: "h1", data: ["a.webp"] } } },
      local: {},
      image: webp,
    });

    await service.importChapters();

    expect(storage.put).toHaveBeenCalledTimes(1);
    expect((storage.put.mock.calls[0] as unknown as [string, Buffer])[1].equals(webp)).toBe(true);
  });

  it("carries on from a half-copied chapter: only the missing pages are downloaded", async () => {
    const { service, repo, fetched } = await build({
      feed: [oldChapter("C1", "1", 2)],
      read: { C1: { baseUrl: CDN, chapter: { hash: "h1", data: ["a.jpg", "b.jpg"] } } },
      local: { C1: { id: "existing", isPublished: false, pages: [{ pageNumber: 1 }] } },
    });

    const report = await service.importChapters();

    expect(repo.createImportedChapter).not.toHaveBeenCalled();
    expect(fetched.filter((u) => u.endsWith(".jpg"))).toEqual([`${CDN}/data/h1/b.jpg`]);
    expect(repo.addChapterPage).toHaveBeenCalledWith(expect.objectContaining({ chapterId: "existing", pageNumber: 2 }));
    expect(repo.publishImportedChapter).toHaveBeenCalledWith("existing", expect.any(Date));
    expect(report.done).toBe(true);
  });

  it("leaves a chapter unpublished when a page fails, and reports it as remaining", async () => {
    const { service, repo } = await build({
      feed: [oldChapter("C1", "1", 2)],
      read: { C1: { baseUrl: CDN, chapter: { hash: "h1", data: ["a.jpg", "b.jpg"] } } },
      local: {},
      failImages: (url) => url.endsWith("b.jpg"),
    });

    const report = await service.importChapters();

    expect(repo.publishImportedChapter).not.toHaveBeenCalled();
    expect(report).toMatchObject({ done: false, remaining: 1, pages: { saved: 1, failed: 1 } });
    expect(report.errors[0]).toContain("page 2");
  });

  it("does not download from a host that is not the old site's", async () => {
    const { service, storage, repo } = await build({
      feed: [oldChapter("C1", "1", 1)],
      read: { C1: { baseUrl: "https://evil.example", chapter: { hash: "h", data: ["a.jpg"] } } },
      local: {},
    });

    const report = await service.importChapters();

    expect(storage.put).not.toHaveBeenCalled();
    expect(repo.createImportedChapter).not.toHaveBeenCalled();
    expect(report.chapters.failed).toBe(1);
    expect(report.errors[0]).toContain("evil.example");
  });

  it("leaves alone a chapter number that already exists in the series", async () => {
    const { service, repo } = await build({
      feed: [oldChapter("C1", "1", 1)],
      read: { C1: { baseUrl: CDN, chapter: { hash: "h", data: ["a.jpg"] } } },
      local: {},
    });
    repo.chapterNumberTaken.mockResolvedValueOnce(true);

    const report = await service.importChapters();

    expect(repo.createImportedChapter).not.toHaveBeenCalled();
    expect(report).toMatchObject({ done: false, chapters: { failed: 1 } });
  });

  it("skips chapters that are already published and counts them as done", async () => {
    const { service, fetched } = await build({
      feed: [oldChapter("C1", "1", 2)],
      read: {},
      local: { C1: { id: "x", isPublished: true, pages: [{ pageNumber: 1 }, { pageNumber: 2 }] } },
    });

    const report = await service.importChapters();

    expect(fetched.some((u) => u.includes("/read/"))).toBe(false);
    expect(report).toMatchObject({ done: true, chapters: { alreadyDone: 1, published: 0 } });
  });

  it("stops when the time budget is spent and says how much is left", async () => {
    const { service, repo } = await build({
      feed: [oldChapter("C1", "1", 2), oldChapter("C2", "2", 2)],
      read: {},
      local: {},
    });

    const report = await service.importChapters(-1);

    expect(repo.createImportedChapter).not.toHaveBeenCalled();
    expect(report).toMatchObject({ done: false, remaining: 2 });
  });
});
