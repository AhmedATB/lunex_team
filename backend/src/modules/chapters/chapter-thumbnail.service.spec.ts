import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import sharp from "sharp";
import type { CatalogService } from "../catalog/catalog.service";
import type { StorageService } from "../images/storage/storage.interface";
import { ChapterThumbnailService } from "./chapter-thumbnail.service";
import type { ChaptersRepository } from "./chapters.repository";
import type { ChaptersService } from "./chapters.service";

const block = (width: number, height: number, background: string) => sharp({ create: { width, height, channels: 3, background } }).png().toBuffer();

const page = async (background: string, patch: string) => {
  const base = sharp({ create: { width: 300, height: 450, channels: 3, background } });
  return base.composite([{ input: await block(200, 200, patch), top: 100, left: 50 }]).webp().toBuffer();
};

const OWNER = { id: "u1", role: "owner" };
const READER = { id: "u2", role: "reader" };

async function build(options: { pageCount?: number; thumbnailAssetId?: string | null } = {}) {
  const count = options.pageCount ?? 10;
  const colours = ["#ffffff", "#e11d48", "#2563eb", "#16a34a", "#f59e0b", "#7c3aed", "#0891b2", "#be123c", "#4d7c0f", "#c2410c"];
  const pages = Array.from({ length: count }, (_, i) => ({ pageNumber: i + 1, assetId: `asset-${i + 1}` }));
  const bytes = new Map<string, Buffer>();
  for (const [i, p] of pages.entries()) bytes.set(`key-${p.assetId}`, await page(i === 0 ? "#ffffff" : "#f5f5f0", colours[i % colours.length]));
  const stored: { key: string; data: Buffer }[] = [];
  const storage = {
    get: jest.fn(async (key: string) => bytes.get(key) as Buffer),
    put: jest.fn(async (key: string, data: Buffer) => {
      stored.push({ key, data });
      return { checksum: "sum" };
    }),
  };
  const repo = {
    findAsset: jest.fn(async (id: string) => ({ id, storageKey: `key-${id}` })),
    createAsset: jest.fn(async () => ({ id: "thumb-asset" })),
    update: jest.fn(async () => ({})),
  };
  const chapters = {
    requireUploader: jest.fn(async (actor: { role: string }) => {
      if (actor.role !== "owner") throw new ForbiddenException({ code: "insufficient_permissions" });
      return { id: "ch1", pages, thumbnailAssetId: options.thumbnailAssetId ?? null };
    }),
  };
  const catalog = { invalidate: jest.fn() };
  const service = new ChapterThumbnailService(repo as unknown as ChaptersRepository, storage as unknown as StorageService, chapters as unknown as ChaptersService, catalog as unknown as CatalogService);
  return { service, repo, storage, stored, catalog, chapters };
}

describe("ChapterThumbnailService", () => {
  it("offers four pictures taken from the chapter's own pages, each with a small preview", async () => {
    const { service } = await build();
    const { items, rounds, pages } = await service.suggestions(OWNER, "ch1", 0);
    expect(items).toHaveLength(4);
    expect(new Set(items.map((i) => i.pageNumber)).size).toBe(4);
    expect(items.every((i) => i.preview.startsWith("data:image/webp;base64,"))).toBe(true);
    expect(rounds).toBe(3);
    expect(pages).toBe(10);
  });

  it("offers others on the next round, and starts over after the last", async () => {
    const { service } = await build();
    const first = (await service.suggestions(OWNER, "ch1", 0)).items.map((i) => i.pageNumber);
    const second = (await service.suggestions(OWNER, "ch1", 1)).items.map((i) => i.pageNumber);
    expect(second.some((p) => first.includes(p))).toBe(false);
    const again = (await service.suggestions(OWNER, "ch1", 3)).items.map((i) => i.pageNumber);
    expect(again).toEqual(first);
  });

  it("looks through the pages once, however many rounds are asked for", async () => {
    const { service, storage } = await build();
    await service.suggestions(OWNER, "ch1", 0);
    const afterFirst = storage.get.mock.calls.length;
    await service.suggestions(OWNER, "ch1", 1);
    // the second round only loads the pages it previews, not all of them again
    expect(storage.get.mock.calls.length - afterFirst).toBeLessThanOrEqual(4);
  });

  it("has nothing to offer for a chapter with no pages", async () => {
    const { service } = await build({ pageCount: 0 });
    await expect(service.suggestions(OWNER, "ch1", 0)).resolves.toEqual({ items: [], rounds: 0, pages: 0 });
  });

  it("makes the featured picture from a page: a wide WebP, stored and linked, and the catalogue told", async () => {
    const { service, repo, stored, catalog } = await build();
    await expect(service.fromPage(OWNER, "ch1", 3)).resolves.toEqual({ thumbnailAssetId: "thumb-asset" });
    expect(stored).toHaveLength(1);
    const meta = await sharp(stored[0].data).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([1280, 720, "webp"]);
    expect(repo.update).toHaveBeenCalledWith("ch1", { thumbnailAssetId: "thumb-asset" });
    expect(catalog.invalidate).toHaveBeenCalled();
    await expect(service.fromPage(OWNER, "ch1", 99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("makes it from an uploaded picture, which keeps its shape", async () => {
    const { service, stored } = await build();
    const file = { buffer: await block(675, 1200, "#123456") } as Express.Multer.File;
    await service.upload(OWNER, "ch1", file);
    const meta = await sharp(stored[0].data).metadata();
    expect([meta.width, meta.height]).toEqual([675, 1200]);
    await expect(service.upload(OWNER, "ch1", undefined)).rejects.toMatchObject({ response: { code: "missing_file" } });
    await expect(service.upload(OWNER, "ch1", { buffer: Buffer.from("nope") } as Express.Multer.File)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("takes it off, and does nothing when there is none", async () => {
    const withOne = await build({ thumbnailAssetId: "old" });
    await withOne.service.remove(OWNER, "ch1");
    expect(withOne.repo.update).toHaveBeenCalledWith("ch1", { thumbnailAssetId: null });
    const without = await build();
    await without.service.remove(OWNER, "ch1");
    expect(without.repo.update).not.toHaveBeenCalled();
  });

  it("is for the people who publish", async () => {
    const { service } = await build();
    await expect(service.suggestions(READER, "ch1", 0)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.fromPage(READER, "ch1", 1)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.upload(READER, "ch1", undefined)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.remove(READER, "ch1")).rejects.toBeInstanceOf(ForbiddenException);
  });
});
