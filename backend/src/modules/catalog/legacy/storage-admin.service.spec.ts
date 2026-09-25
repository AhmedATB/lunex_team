import { ConflictException } from "@nestjs/common";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { R2StorageService } from "../../images/storage/r2-storage.service";
import { StorageAdminService } from "./storage-admin.service";

const R2_ENV = { R2_ACCOUNT_ID: "a", R2_BUCKET_NAME: "b", R2_ACCESS_KEY_ID: "c", R2_SECRET_ACCESS_KEY: "d" };
const VARS = [...Object.keys(R2_ENV), "IMAGE_STORAGE_BACKEND"];

function build(blobs: Record<string, Buffer>, remote: Record<string, Buffer> = {}) {
  const prisma = {
    imageBlob: {
      count: jest.fn(async () => Object.keys(blobs).length),
      findMany: jest.fn(async () => Object.keys(blobs).map((storageKey) => ({ storageKey }))),
      findUnique: jest.fn(async ({ where }: { where: { storageKey: string } }) => (blobs[where.storageKey] ? { storageKey: where.storageKey, data: blobs[where.storageKey] } : null)),
    },
  };
  const r2 = {
    get: jest.fn(async (key: string) => {
      if (!remote[key]) throw new Error("not found");
      return remote[key];
    }),
    put: jest.fn(async (key: string, data: Buffer) => {
      remote[key] = data;
      return { checksum: "x" };
    }),
  };
  return { service: new StorageAdminService(prisma as unknown as PrismaService, r2 as unknown as R2StorageService), prisma, r2, remote };
}

describe("StorageAdminService", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    VARS.forEach((v) => {
      saved[v] = process.env[v];
      delete process.env[v];
    });
  });
  afterEach(() => {
    VARS.forEach((v) => {
      if (saved[v] === undefined) delete process.env[v];
      else process.env[v] = saved[v];
    });
  });

  it("reports where images go, whether R2 is set up, and how many are still in the database", async () => {
    const { service } = build({ a: Buffer.from("1"), b: Buffer.from("2") });
    expect(await service.status()).toEqual({ backend: "database", r2Configured: false, databaseImages: 2 });

    Object.assign(process.env, R2_ENV, { IMAGE_STORAGE_BACKEND: "r2" });
    expect(await service.status()).toEqual({ backend: "r2", r2Configured: true, databaseImages: 2 });
  });

  it("will not copy until all four R2 settings exist", async () => {
    const { service, r2 } = build({ a: Buffer.from("1") });
    process.env.R2_ACCOUNT_ID = "only-one";
    await expect(service.copyToR2()).rejects.toBeInstanceOf(ConflictException);
    expect(r2.put).not.toHaveBeenCalled();
  });

  it("copies what is missing, verifies it, and leaves what is already there", async () => {
    Object.assign(process.env, R2_ENV);
    const { service, r2, remote } = build({ a: Buffer.from("aaa"), b: Buffer.from("bbb") }, { a: Buffer.from("aaa") });

    const report = await service.copyToR2();

    expect(report).toMatchObject({ copied: 1, alreadyThere: 1, failed: 0, remaining: 0, done: true });
    expect(remote.b.toString()).toBe("bbb");
    expect(r2.put).toHaveBeenCalledTimes(1);
  });

  it("re-uploads an image whose R2 copy differs, and reports a failed read-back", async () => {
    Object.assign(process.env, R2_ENV);
    const { service, r2 } = build({ a: Buffer.from("good") }, { a: Buffer.from("stale") });
    let stored: Buffer | undefined;
    r2.put.mockImplementation(async (_key: string, data: Buffer) => {
      stored = data;
      return { checksum: "x" };
    });
    r2.get.mockImplementation(async () => (stored ? Buffer.from("corrupted") : Buffer.from("stale")));

    const report = await service.copyToR2();

    expect(report).toMatchObject({ copied: 0, failed: 1, done: false });
    expect(report.errors[0]).toContain("read-back");
  });

  it("stops at the time budget and says how many are left", async () => {
    Object.assign(process.env, R2_ENV);
    const { service } = build({ a: Buffer.from("1"), b: Buffer.from("2") });
    const report = await service.copyToR2(-1);
    expect(report).toMatchObject({ copied: 0, remaining: 2, done: false });
  });
});
