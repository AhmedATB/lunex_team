import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { hashPassword } from "../auth/crypto/password.util";
import type { ModerationService } from "../moderation/moderation.service";
import type { NotificationsService } from "../notifications/notifications.service";
import type { UsersRepository } from "./users.repository";
import { UsersService } from "./users.service";

const PASSWORD = "correct-horse-battery-staple";

function baseUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "reader@example.com",
    username: "reader_one",
    passwordHash: null as string | null,
    role: "reader",
    ...overrides,
  };
}

function build(user: ReturnType<typeof baseUser> | null) {
  const repo = {
    findById: jest.fn().mockResolvedValue(user),
    deleteAccount: jest.fn().mockResolvedValue(undefined),
    collectExport: jest.fn(),
  };
  const service = new UsersService(repo as unknown as UsersRepository, {} as NotificationsService, {} as ModerationService);
  return { service, repo };
}

describe("UsersService.deleteAccount", () => {
  it("deletes a password account when the password is correct", async () => {
    const { service, repo } = build(baseUser({ passwordHash: await hashPassword(PASSWORD) }));
    await service.deleteAccount("user-1", { password: PASSWORD });
    expect(repo.deleteAccount).toHaveBeenCalledWith("user-1", "reader@example.com");
  });

  it.each([{ password: "wrong-password-entirely" }, {}, { confirmUsername: "reader_one" }])(
    "refuses a password account without the right password (%j)",
    async (dto) => {
      const { service, repo } = build(baseUser({ passwordHash: await hashPassword(PASSWORD) }));
      await expect(service.deleteAccount("user-1", dto)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(repo.deleteAccount).not.toHaveBeenCalled();
    }
  );

  it("lets an OAuth-only account confirm by retyping its username", async () => {
    const { service, repo } = build(baseUser());
    await service.deleteAccount("user-1", { confirmUsername: "reader_one" });
    expect(repo.deleteAccount).toHaveBeenCalledWith("user-1", "reader@example.com");
  });

  it.each([{}, { confirmUsername: "someone_else" }, { password: PASSWORD }])(
    "refuses an OAuth-only account with a wrong confirmation (%j)",
    async (dto) => {
      const { service, repo } = build(baseUser());
      await expect(service.deleteAccount("user-1", dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.deleteAccount).not.toHaveBeenCalled();
    }
  );

  it("never deletes the owner account, even with valid credentials", async () => {
    const { service, repo } = build(baseUser({ role: "owner", passwordHash: await hashPassword(PASSWORD) }));
    await expect(service.deleteAccount("user-1", { password: PASSWORD })).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.deleteAccount).not.toHaveBeenCalled();
  });

  it("reports a missing account", async () => {
    const { service, repo } = build(null);
    await expect(service.deleteAccount("ghost", { password: PASSWORD })).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.deleteAccount).not.toHaveBeenCalled();
  });
});

describe("UsersService.exportData", () => {
  const exported = {
    user: {
      id: "user-1",
      email: "reader@example.com",
      username: "reader_one",
      displayName: null,
      bio: null,
      role: "reader",
      isBanned: false,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-02-01T00:00:00Z"),
      avatarMimeType: "image/webp",
      profileVisibility: "public",
      historyVisibility: "private",
      favoritesVisibility: "private",
    },
    oauthAccounts: [{ provider: "discord", providerAccountId: "123", createdAt: new Date("2026-01-02T00:00:00Z") }],
    devices: [],
    sessions: [],
    loginEvents: [{ at: new Date("2026-03-01T00:00:00Z"), ip: "203.0.113.7", outcome: "success" }],
    chapterUnlocks: [],
    notifications: [],
    imageAccess: [],
    activity: [],
    bookmarks: [],
    readingProgress: [],
    sanctions: [],
    comments: [],
  };

  it("returns the caller's data with a hasCustomAvatar flag instead of the mime type", async () => {
    const { service, repo } = build(baseUser());
    repo.collectExport.mockResolvedValue(exported);

    const result = await service.exportData("user-1");

    expect(result.account).toMatchObject({ id: "user-1", email: "reader@example.com", hasCustomAvatar: true });
    expect(result.account).not.toHaveProperty("avatarMimeType");
    expect(result.loginHistory).toHaveLength(1);
    expect(result.linkedAccounts[0]).toMatchObject({ provider: "discord" });
    expect(typeof result.exportedAt).toBe("string");
  });

  it("never carries a secret field", async () => {
    const { service, repo } = build(baseUser());
    repo.collectExport.mockResolvedValue(exported);
    const json = JSON.stringify(await service.exportData("user-1"));
    for (const secret of ["passwordHash", "refreshTokenHash", "fingerprintHash", "avatarImage"]) {
      expect(json).not.toContain(secret);
    }
  });

  it("flags an account without an avatar", async () => {
    const { service, repo } = build(baseUser());
    repo.collectExport.mockResolvedValue({ ...exported, user: { ...exported.user, avatarMimeType: null } });
    expect((await service.exportData("user-1")).account.hasCustomAvatar).toBe(false);
  });

  it("reports a missing account", async () => {
    const { service, repo } = build(baseUser());
    repo.collectExport.mockResolvedValue({ ...exported, user: null });
    await expect(service.exportData("ghost")).rejects.toBeInstanceOf(NotFoundException);
  });
});
