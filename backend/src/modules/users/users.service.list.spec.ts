import { ForbiddenException } from "@nestjs/common";
import type { ModerationService } from "../moderation/moderation.service";
import type { NotificationsService } from "../notifications/notifications.service";
import type { UsersRepository } from "./users.repository";
import { UsersService } from "./users.service";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "u1",
  email: "a@example.com",
  username: "a_user",
  role: "reader",
  createdAt: new Date("2026-09-20T10:00:00Z"),
  updatedAt: new Date("2026-09-21T10:00:00Z"),
  displayName: null,
  bio: null,
  avatarMimeType: null,
  isBanned: false,
  bannedUntil: null,
  mutedUntil: null,
  xp: 0,
  chaptersRead: 0,
  ...overrides,
});

function build(actorRole: string | null) {
  const repo = {
    findById: jest.fn().mockResolvedValue(actorRole ? { id: "actor", role: actorRole } : null),
    listAll: jest.fn().mockResolvedValue({ total: 2, rows: [row(), row({ id: "u2", username: "b_user", avatarMimeType: "image/webp", xp: 5000, chaptersRead: 40, isBanned: true })] }),
  };
  const service = new UsersService(repo as unknown as UsersRepository, {} as NotificationsService, {} as ModerationService);
  return { service, repo };
}

describe("UsersService.listAll", () => {
  it("lists every account for the owner and super administrators, and nobody else", async () => {
    for (const role of ["owner", "super_administrator"]) {
      const { service } = build(role);
      await expect(service.listAll("actor", {})).resolves.toMatchObject({ total: 2 });
    }
    for (const role of ["moderator", "editor", "reader"]) {
      const { service, repo } = build(role);
      await expect(service.listAll("actor", {})).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.listAll).not.toHaveBeenCalled();
    }
    await expect(build(null).service.listAll("actor", {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("pages, filters and shapes the rows without leaking anything a list should not carry", async () => {
    const { service, repo } = build("owner");
    const result = await service.listAll("actor", { q: "user", role: "reader", banned: false, page: 3, pageSize: 20 });
    expect(repo.listAll).toHaveBeenCalledWith({ query: "user", role: "reader", bannedOnly: false, skip: 40, take: 20 });
    expect(result.page).toBe(3);
    expect(result.items[0]).toMatchObject({ id: "u1", username: "a_user", level: 1, chaptersRead: 0, avatarVersion: null, isBanned: false });
    expect(result.items[1]).toMatchObject({ id: "u2", avatarVersion: "2026-09-21T10:00:00.000Z", isBanned: true, chaptersRead: 40 });
    expect(result.items[1].level).toBeGreaterThan(1);
    expect(JSON.stringify(result)).not.toMatch(/passwordHash|avatarImage/);
  });

  it("starts at the first page of 50 by default", async () => {
    const { service, repo } = build("owner");
    await service.listAll("actor", {});
    expect(repo.listAll).toHaveBeenCalledWith({ query: undefined, role: undefined, bannedOnly: undefined, skip: 0, take: 50 });
  });
});
