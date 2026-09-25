import { ConflictException } from "@nestjs/common";
import type { RequestContext } from "../../common/middleware/request-context.middleware";
import type { ModerationService } from "../moderation/moderation.service";
import type { NotificationsService } from "../notifications/notifications.service";
import type { UsersRepository } from "./users.repository";
import { UsersService } from "./users.service";

const CTX = { ip: "203.0.113.5" } as RequestContext;

function build(current: { id: string; username: string; role: string }, others: { id: string; username: string }[] = []) {
  const repo = {
    findById: jest.fn().mockResolvedValue(current),
    findByUsername: jest.fn(async (name: string) => others.find((u) => u.username === name) ?? null),
    findByUsernameKey: jest.fn(async () => null),
    updateProfile: jest.fn(async (id: string, patch: Record<string, unknown>) => ({ email: "x@example.com", createdAt: new Date(), ...current, ...patch })),
    writeAuditLog: jest.fn(async () => ({})),
  };
  const service = new UsersService(repo as unknown as UsersRepository, {} as NotificationsService, {} as ModerationService);
  return { service, repo };
}

describe("renaming to a reserved name", () => {
  it("is refused for an ordinary account", async () => {
    const { service, repo } = build({ id: "u1", username: "reader_one", role: "reader" });
    for (const name of ["Lunex", "LunexTeam", "AhmedATB", "admin"]) {
      await expect(service.updateProfile("u1", { username: name }, CTX)).rejects.toMatchObject({ response: { code: "username_reserved" } });
    }
    expect(repo.updateProfile).not.toHaveBeenCalled();
  });

  it("is refused for staff below super administrator too (an editor, a moderator)", async () => {
    for (const role of ["editor", "moderator", "uploader"]) {
      const { service } = build({ id: "u1", username: "staff_one", role });
      await expect(service.updateProfile("u1", { username: "Lunex" }, CTX)).rejects.toBeInstanceOf(ConflictException);
    }
  });

  it.each(["owner", "super_administrator"])("is allowed for %s, who may take the team's own handles", async (role) => {
    const { service, repo } = build({ id: "u1", username: "boss", role });
    await service.updateProfile("u1", { username: "AhmedATB" }, CTX);
    expect(repo.updateProfile).toHaveBeenCalledWith("u1", expect.objectContaining({ username: "AhmedATB" }));
  });

  it("still cannot take a name someone else already holds, whatever the role", async () => {
    const { service } = build({ id: "u1", username: "boss", role: "owner" }, [{ id: "u2", username: "Taken_One" }]);
    await expect(service.updateProfile("u1", { username: "Taken_One" }, CTX)).rejects.toMatchObject({ response: { code: "username_taken" } });
  });
});

describe("changing the display name to one that would pass for the team", () => {
  it("is refused for an ordinary account", async () => {
    const { service, repo } = build({ id: "u1", username: "reader_one", role: "reader" });
    for (const name of ["LUNEX Admin", "Lunex Team", "الإدارة"]) {
      await expect(service.updateProfile("u1", { displayName: name }, CTX)).rejects.toMatchObject({ response: { code: "display_name_reserved" } });
    }
    expect(repo.updateProfile).not.toHaveBeenCalled();
  });

  it("is allowed for the owner, and an ordinary name is fine for anyone", async () => {
    const owner = build({ id: "u1", username: "boss", role: "owner" });
    await owner.service.updateProfile("u1", { displayName: "LUNEX Team" }, CTX);
    expect(owner.repo.updateProfile).toHaveBeenCalledWith("u1", expect.objectContaining({ displayName: "LUNEX Team" }));

    const reader = build({ id: "u2", username: "reader_two", role: "reader" });
    await reader.service.updateProfile("u2", { displayName: "قيس أحمد" }, CTX);
    expect(reader.repo.updateProfile).toHaveBeenCalledWith("u2", expect.objectContaining({ displayName: "قيس أحمد" }));
  });
});
