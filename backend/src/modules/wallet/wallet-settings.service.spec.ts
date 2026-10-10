import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../prisma/prisma.service";
import { WalletSettingsService } from "./wallet-settings.service";

function build(options: { role?: string; stored?: string | null; env?: Record<string, string> } = {}) {
  let stored = options.stored === undefined ? null : options.stored;
  const prisma = {
    user: { findUnique: jest.fn(async () => ({ role: options.role ?? "owner" })) },
    siteSetting: {
      findUnique: jest.fn(async () => (stored === null ? null : { key: "wallet_config", value: stored })),
      upsert: jest.fn(async ({ update }: { update: { value: string } }) => {
        stored = update.value;
      }),
    },
    auditLog: { create: jest.fn(async () => undefined) },
  };
  const env = { get: (name: string) => options.env?.[name] } as unknown as ConfigService;
  return { service: new WalletSettingsService(prisma as unknown as PrismaService, env), prisma, saved: () => stored };
}

describe("the lock settings in force", () => {
  it("start with nothing locked when nothing was ever set", async () => {
    expect(await build().service.current()).toEqual({ lockedWindow: 0, freeFirstChapters: 3, chaptersPerCredit: 10, coinPrice: 50 });
  });

  it("take what the environment says where the admin panel said nothing", async () => {
    const { service } = build({ env: { LOCKED_CHAPTER_COUNT: "4", CHAPTER_COIN_PRICE: "70" } });
    expect(await service.current()).toMatchObject({ lockedWindow: 4, coinPrice: 70 });
  });

  it("let what the admin panel saved win over the environment, a setting at a time", async () => {
    const { service } = build({ stored: '{"lockedWindow":0}', env: { LOCKED_CHAPTER_COUNT: "3", CHAPTER_COIN_PRICE: "70" } });
    expect(await service.current()).toMatchObject({ lockedWindow: 0, coinPrice: 70 });
  });

  it("ignore a stored value that is not valid instead of failing", async () => {
    expect(await build({ stored: "not json" }).service.current()).toMatchObject({ lockedWindow: 0 });
    expect(await build({ stored: '{"lockedWindow":999}' }).service.current()).toMatchObject({ lockedWindow: 0 });
  });
});

describe("changing the lock settings", () => {
  it("is for the owner and super administrators only", async () => {
    for (const role of ["editor", "uploader", "team_leader", "reader"]) {
      const { service, prisma } = build({ role });
      await expect(service.update("u1", { lockedWindow: 3 })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.view("u1")).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.siteSetting.upsert).not.toHaveBeenCalled();
    }
    for (const role of ["owner", "super_administrator"]) {
      await expect(build({ role }).service.update("u1", { lockedWindow: 3 })).resolves.toBeDefined();
    }
  });

  it("saves the change, applies it at once, keeps the other settings, and leaves a trace", async () => {
    const { service, prisma, saved } = build({ stored: '{"coinPrice":80}' });
    const result = await service.update("u1", { lockedWindow: 3 });
    expect(result.values).toMatchObject({ lockedWindow: 3, coinPrice: 80 });
    expect(JSON.parse(saved() ?? "{}")).toEqual({ coinPrice: 80, lockedWindow: 3 });
    expect(await service.current()).toMatchObject({ lockedWindow: 3 });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: { actorId: "u1", action: "wallet.settings.update", target: "lockedWindow=3" } });
  });

  it("can switch the lock back off with zero", async () => {
    const { service } = build({ stored: '{"lockedWindow":3}' });
    expect((await service.update("u1", { lockedWindow: 0 })).values.lockedWindow).toBe(0);
  });

  it("refuses a number outside its limits and writes nothing", async () => {
    const { service, prisma } = build();
    await expect(service.update("u1", { lockedWindow: 51 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update("u1", { coinPrice: 0 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update("u1", { chaptersPerCredit: 2.5 })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.siteSetting.upsert).not.toHaveBeenCalled();
  });

  it("writes nothing when nothing was asked to change", async () => {
    const { service, prisma } = build();
    await service.update("u1", {});
    expect(prisma.siteSetting.upsert).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
